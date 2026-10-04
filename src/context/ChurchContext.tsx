import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import * as api from "../lib/church";
import {
  canUseOfflineSnapshot,
  cachedAnnouncements,
  cachedSchedule,
  cachedServices,
  eligibleOfflineService,
  ConnectionState,
  nextFourSundays,
  OFFLINE_VERSION,
  OfflineSnapshotV2,
  offlineExpiry,
  sanitizeOfflineDetail,
  sanitizeOfflineWeeks,
  shouldRefreshOffline,
} from "../domain/offline";
import {
  clearOfflineSnapshot,
  readOfflineSnapshot,
  replaceOfflineSnapshot,
} from "../lib/offlineStorage";

type Identity = { session: Session; membership: api.Membership; name: string };
type State = {
  session: Session | null;
  membership: api.Membership | null;
  name: string;
  loading: boolean;
  error: string;
  connection: ConnectionState;
  lastVerifiedAt: string | null;
  lastSyncedAt: string | null;
  offlineExpiresAt: string | null;
  cachedServiceCount: number;
  cachedAnnouncementCount: number;
  syncingOffline: boolean;
  refresh: () => Promise<void>;
  refreshOffline: () => Promise<void>;
  clearOffline: () => Promise<void>;
  signOut: () => Promise<void>;
  loadSchedule: (from: string, to: string) => Promise<api.ScheduleWeek[]>;
  loadServices: (from: string, to: string) => Promise<api.Service[]>;
  loadServiceDetail: (id: string) => Promise<api.ServiceDetail>;
  loadAnnouncements: () => Promise<api.Announcement[]>;
  loadAnnouncement: (id: string) => Promise<api.Announcement>;
};
const Context = createContext<State>(null!);
export const useChurch = () => useContext(Context);

export function ChurchProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<api.Membership | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("online");
  const [snapshot, setSnapshot] = useState<OfflineSnapshotV2 | null>(null);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const version = useRef(0);
  const sessionRef = useRef<Session | null>(null);
  const snapshotRef = useRef<OfflineSnapshotV2 | null>(null);
  const identityRef = useRef<Identity | null>(null);
  const onlineVerifiedRef = useRef(false);
  const syncPromise = useRef<Promise<void> | null>(null);

  const rememberSnapshot = useCallback((value: OfflineSnapshotV2 | null) => {
    snapshotRef.current = value;
    setSnapshot(value);
  }, []);
  const clearOffline = useCallback(async () => {
    rememberSnapshot(null);
    await clearOfflineSnapshot();
  }, [rememberSnapshot]);

  const buildSnapshot = useCallback(
    async (identity: Identity, verifiedAt: string) => {
      const sundays = nextFourSundays();
      const from = sundays[0];
      const to = sundays[sundays.length - 1];
      const [rawWeeks, visible, announcements] = await Promise.all([
        api.readSchedule(from, to),
        api.visibleServices(from, to),
        api.listActiveAnnouncements(),
      ]);
      const weeks = sanitizeOfflineWeeks(rawWeeks);
      const services = visible.filter(eligibleOfflineService);
      const details = Object.fromEntries(
        await Promise.all(
          services.map(
            async (item) =>
              [
                item.id,
                sanitizeOfflineDetail(await api.getServiceDetail(item.id)),
              ] as const,
          ),
        ),
      );
      const value: OfflineSnapshotV2 = {
        version: OFFLINE_VERSION,
        userId: identity.session.user.id,
        teamId: api.churchId,
        membership: identity.membership,
        name: identity.name,
        verifiedAt,
        syncedAt: new Date().toISOString(),
        sundays,
        weeks,
        services,
        details,
        announcements,
      };
      await replaceOfflineSnapshot(value);
      rememberSnapshot(value);
    },
    [rememberSnapshot],
  );

  const syncForIdentity = useCallback(
    async (
      identity: Identity,
      force: boolean,
      verifiedAt = new Date().toISOString(),
    ) => {
      if (!onlineVerifiedRef.current) {
        if (force)
          throw new Error(
            "Keanggotaan harus diverifikasi secara online terlebih dahulu.",
          );
        return;
      }
      if (!force && !shouldRefreshOffline(snapshotRef.current)) return;
      if (syncPromise.current) return syncPromise.current;
      setSyncingOffline(true);
      const work = buildSnapshot(identity, verifiedAt).finally(() => {
        syncPromise.current = null;
        setSyncingOffline(false);
      });
      syncPromise.current = work;
      return work;
    },
    [buildSnapshot],
  );

  const restoreForNetworkFailure = useCallback(
    async (activeSession: Session) => {
      const stored = snapshotRef.current || (await readOfflineSnapshot());
      if (
        !stored ||
        !canUseOfflineSnapshot(stored, activeSession.user.id, api.churchId)
      ) {
        if (stored) await clearOffline();
        return false;
      }
      rememberSnapshot(stored);
      identityRef.current = {
        session: activeSession,
        membership: stored.membership,
        name: stored.name,
      };
      onlineVerifiedRef.current = false;
      setSession(activeSession);
      sessionRef.current = activeSession;
      setMembership(stored.membership);
      setName(stored.name);
      setConnection("offline");
      setError("");
      return true;
    },
    [clearOffline, rememberSnapshot],
  );

  const refresh = useCallback(async () => {
    const ticket = ++version.current;
    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!data.session) {
        if (ticket !== version.current) return;
        identityRef.current = null;
        onlineVerifiedRef.current = false;
        setSession(null);
        sessionRef.current = null;
        setMembership(null);
        setName("");
        setConnection("online");
        setError("");
        await clearOffline();
        return;
      }
      try {
        const [nextMembership, nextName] = await Promise.all([
          api.getMembership(data.session.user.id),
          api.getProfileName(data.session.user.id),
        ]);
        if (ticket !== version.current) return;
        if (!nextMembership) {
          identityRef.current = null;
          onlineVerifiedRef.current = false;
          setSession(data.session);
          sessionRef.current = data.session;
          setMembership(null);
          setName(nextName);
          setConnection("online");
          setError("");
          await clearOffline();
          return;
        }
        const identity = {
          session: data.session,
          membership: nextMembership,
          name: nextName,
        };
        identityRef.current = identity;
        onlineVerifiedRef.current = true;
        setSession(data.session);
        sessionRef.current = data.session;
        setMembership(nextMembership);
        setName(nextName);
        setConnection("online");
        setError("");
        const verifiedAt = new Date().toISOString();
        const stored = snapshotRef.current || (await readOfflineSnapshot());
        if (
          stored &&
          stored.userId === data.session.user.id &&
          stored.teamId === api.churchId
        ) {
          const verified = {
            ...stored,
            membership: nextMembership,
            name: nextName,
            verifiedAt,
          };
          await replaceOfflineSnapshot(verified);
          rememberSnapshot(verified);
        } else if (stored) await clearOffline();
        void syncForIdentity(identity, false, verifiedAt).catch((syncError) => {
          if (api.asChurchApiError(syncError).kind === "denied")
            void clearOffline();
        });
      } catch (membershipError) {
        const typed = api.asChurchApiError(membershipError);
        if (ticket !== version.current) return;
        if (
          typed.kind === "network" &&
          (await restoreForNetworkFailure(data.session))
        )
          return;
        if (typed.kind === "denied") await clearOffline();
        throw typed;
      }
    } catch (caught) {
      if (ticket === version.current) {
        const typed = api.asChurchApiError(caught);
        if (
          typed.kind === "network" &&
          sessionRef.current &&
          (await restoreForNetworkFailure(sessionRef.current))
        )
          return;
        setError(typed.message);
        setMembership(null);
      }
    } finally {
      if (ticket === version.current) setLoading(false);
    }
  }, [
    clearOffline,
    rememberSnapshot,
    restoreForNetworkFailure,
    syncForIdentity,
  ]);

  const refreshOffline = useCallback(async () => {
    await refresh();
    if (!identityRef.current || !onlineVerifiedRef.current)
      throw new Error("Hubungkan internet untuk memverifikasi keanggotaan.");
    await syncForIdentity(identityRef.current, true);
    setConnection("online");
  }, [refresh, syncForIdentity]);

  const fallback = useCallback(
    async <T,>(
      network: () => Promise<T>,
      cached: (value: OfflineSnapshotV2) => T,
    ) => {
      try {
        const value = await network();
        if (!onlineVerifiedRef.current) await refresh();
        if (onlineVerifiedRef.current) setConnection("online");
        if (identityRef.current)
          void syncForIdentity(identityRef.current, false).catch(
            () => undefined,
          );
        return value;
      } catch (caught) {
        const typed = api.asChurchApiError(caught);
        if (typed.kind === "denied") {
          await clearOffline();
          throw typed;
        }
        if (typed.kind !== "network") throw typed;
        const active = identityRef.current?.session;
        const stored = snapshotRef.current || (await readOfflineSnapshot());
        if (
          !active ||
          !stored ||
          !canUseOfflineSnapshot(stored, active.user.id, api.churchId)
        ) {
          if (stored) await clearOffline();
          throw typed;
        }
        rememberSnapshot(stored);
        setConnection("offline");
        return cached(stored);
      }
    },
    [clearOffline, refresh, rememberSnapshot, syncForIdentity],
  );

  const loadSchedule = useCallback(
    (from: string, to: string) =>
      fallback(
        () => api.readSchedule(from, to),
        (value) => cachedSchedule(value, from, to),
      ),
    [fallback],
  );
  const loadServices = useCallback(
    (from: string, to: string) =>
      fallback(
        () => api.visibleServices(from, to),
        (value) => cachedServices(value, from, to),
      ),
    [fallback],
  );
  const loadServiceDetail = useCallback(
    (id: string) =>
      fallback(
        () => api.getServiceDetail(id),
        (value) => {
          const detail = value.details[id];
          if (!detail)
            throw new Error("Ibadah ini tidak tersedia di data offline.");
          return detail;
        },
      ),
    [fallback],
  );
  const loadAnnouncements = useCallback(
    () =>
      fallback(api.listActiveAnnouncements, (value) =>
        cachedAnnouncements(value),
      ),
    [fallback],
  );
  const loadAnnouncement = useCallback(
    (id: string) =>
      fallback(
        () => api.getAnnouncement(id),
        (value) => {
          const item = cachedAnnouncements(value).find(
            (announcement) => announcement.id === id,
          );
          if (!item)
            throw new Error("Pengumuman ini tidak tersedia di data offline.");
          return item;
        },
      ),
    [fallback],
  );
  const signOut = useCallback(async () => {
    await clearOffline();
    identityRef.current = null;
    sessionRef.current = null;
    onlineVerifiedRef.current = false;
    const result = await supabase.auth.signOut();
    if (result.error) throw result.error;
  }, [clearOffline]);

  useEffect(() => {
    void (async () => {
      rememberSnapshot(await readOfflineSnapshot());
      await refresh();
    })();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        ++version.current;
        onlineVerifiedRef.current = false;
        setMembership(null);
        setLoading(true);
        if (event === "SIGNED_OUT") void clearOffline();
      }
      setTimeout(() => void refresh(), 0);
    });
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      data.subscription.unsubscribe();
      listener.remove();
    };
  }, [clearOffline, refresh, rememberSnapshot]);

  return (
    <Context.Provider
      value={{
        session,
        membership,
        name,
        loading,
        error,
        connection,
        lastVerifiedAt: snapshot?.verifiedAt || null,
        lastSyncedAt: snapshot?.syncedAt || null,
        offlineExpiresAt: snapshot ? offlineExpiry(snapshot) : null,
        cachedServiceCount: snapshot?.services.length || 0,
        cachedAnnouncementCount: snapshot
          ? cachedAnnouncements(snapshot).length
          : 0,
        syncingOffline,
        refresh,
        refreshOffline,
        clearOffline,
        signOut,
        loadSchedule,
        loadServices,
        loadServiceDetail,
        loadAnnouncements,
        loadAnnouncement,
      }}
    >
      {children}
    </Context.Provider>
  );
}
