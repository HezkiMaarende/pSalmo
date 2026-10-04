import { gcm } from "@noble/ciphers/aes.js";
import {
  bytesToHex,
  bytesToUtf8,
  hexToBytes,
  utf8ToBytes,
} from "@noble/ciphers/utils.js";
import type {
  MembershipRole,
  ServiceStatus,
  ServiceType,
  SongStructureSection,
} from "./service";
import { upcomingSunday } from "./calendar";
import { activeAnnouncements, type Announcement } from "./announcements";

export const OFFLINE_VERSION = 2 as const;
export const OFFLINE_VALID_MS = 7 * 24 * 60 * 60 * 1000;
export const OFFLINE_REFRESH_MS = 15 * 60 * 1000;
export const OFFLINE_PLAINTEXT_LIMIT = 2 * 1024 * 1024;

export type DataSource = "network" | "cache";
export type ConnectionState = "online" | "offline";

export interface OfflineMembership {
  role: MembershipRole;
  song_editor: boolean;
}
export interface OfflineService {
  id: string;
  team_id: string;
  title: string;
  service_type: ServiceType;
  service_date: string;
  service_day: string;
  status: ServiceStatus;
}
export interface OfflineRosterRow {
  id: string;
  role_name: string;
  display_name: string | null;
}
export interface OfflineScheduleService {
  id: string;
  title: string;
  service_type: ServiceType;
  status: ServiceStatus;
  assigned: boolean;
  can_open: boolean;
  can_edit: boolean;
  roster: OfflineRosterRow[];
}
export interface OfflineScheduleWeek {
  sunday: string;
  published_at: string | null;
  services: OfflineScheduleService[];
}
interface OfflineReference {
  id?: string;
  label: string;
  url: string;
  position?: number;
}
interface OfflineSetlistItem {
  id: string;
  position: number;
  song_id: string | null;
  proposed_title: string | null;
  artist: string | null;
  key: string | null;
  bpm: number | null;
  time_signature: string | null;
  structure: SongStructureSection[];
  lyrics_or_chords: string | null;
  arrangement_url: string | null;
  library_references: OfflineReference[];
  notes: string | null;
}
export interface OfflineServiceDetail {
  service: OfflineService;
  revision: number;
  items: OfflineSetlistItem[];
  can_edit: boolean;
  assignments: (OfflineRosterRow & {
    person_id: string | null;
    user_id: string | null;
  })[];
  notes: { id: string; body: string }[];
  media: { id: string; label: string; url: string }[];
}

export interface OfflineIdentity {
  userId: string;
  teamId: string;
  membership: OfflineMembership;
  name: string;
  verifiedAt: string;
}

export interface OfflineStatus {
  connection: ConnectionState;
  lastVerifiedAt: string | null;
  lastSyncedAt: string | null;
  expiresAt: string | null;
  cachedServiceCount: number;
}

export interface OfflineSnapshotV2 extends OfflineIdentity {
  version: typeof OFFLINE_VERSION;
  syncedAt: string;
  sundays: string[];
  weeks: OfflineScheduleWeek[];
  services: OfflineService[];
  details: Record<string, OfflineServiceDetail>;
  announcements: Announcement[];
}

export function nextFourSundays(now = new Date()): string[] {
  const first = new Date(`${upcomingSunday(now)}T12:00:00Z`);
  return Array.from({ length: 4 }, (_, index) => {
    const day = new Date(first);
    day.setUTCDate(day.getUTCDate() + index * 7);
    return day.toISOString().slice(0, 10);
  });
}

export function sanitizeOfflineDetail(
  detail: OfflineServiceDetail,
): OfflineServiceDetail {
  return {
    ...detail,
    can_edit: false,
    assignments: detail.assignments.map(
      ({ person_id: _person, user_id: _user, ...row }) => ({
        ...row,
        person_id: null,
        user_id: null,
      }),
    ),
  };
}

export function eligibleOfflineService<T extends { status: string }>(
  service: T,
): boolean {
  return service.status === "draft" || service.status === "approved";
}

export function sanitizeOfflineWeeks(
  weeks: OfflineScheduleWeek[],
): OfflineScheduleWeek[] {
  return weeks.map((week) => ({
    ...week,
    services: week.services.filter(eligibleOfflineService),
  }));
}

export function isOfflineSnapshot(value: unknown): value is OfflineSnapshotV2 {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<OfflineSnapshotV2>;
  return (
    item.version === OFFLINE_VERSION &&
    typeof item.userId === "string" &&
    typeof item.teamId === "string" &&
    !!item.membership &&
    typeof item.name === "string" &&
    typeof item.verifiedAt === "string" &&
    typeof item.syncedAt === "string" &&
    Array.isArray(item.sundays) &&
    Array.isArray(item.weeks) &&
    Array.isArray(item.services) &&
    !!item.details &&
    typeof item.details === "object" &&
    Array.isArray(item.announcements)
  );
}

export function offlineExpiry(snapshot: OfflineSnapshotV2): string {
  return new Date(
    new Date(snapshot.verifiedAt).getTime() + OFFLINE_VALID_MS,
  ).toISOString();
}

export function canUseOfflineSnapshot(
  snapshot: OfflineSnapshotV2,
  userId: string,
  teamId: string,
  now = new Date(),
): boolean {
  const verified = new Date(snapshot.verifiedAt).getTime();
  return (
    snapshot.userId === userId &&
    snapshot.teamId === teamId &&
    Number.isFinite(verified) &&
    now.getTime() <= verified + OFFLINE_VALID_MS
  );
}

export function shouldRefreshOffline(
  snapshot: OfflineSnapshotV2 | null,
  now = new Date(),
): boolean {
  if (!snapshot) return true;
  const synced = new Date(snapshot.syncedAt).getTime();
  return (
    !Number.isFinite(synced) || now.getTime() - synced >= OFFLINE_REFRESH_MS
  );
}

export function cachedSchedule(
  snapshot: OfflineSnapshotV2,
  from: string,
  to: string,
): OfflineScheduleWeek[] {
  return snapshot.weeks.filter(
    (week) => week.sunday >= from && week.sunday <= to,
  );
}

export function cachedServices(
  snapshot: OfflineSnapshotV2,
  from: string,
  to: string,
): OfflineService[] {
  return snapshot.services.filter(
    (service) => service.service_day >= from && service.service_day <= to,
  );
}

export function cachedAnnouncements(
  snapshot: OfflineSnapshotV2,
  now = new Date(),
): Announcement[] {
  return activeAnnouncements(snapshot.announcements, now);
}

export function sealOfflineSnapshot(
  snapshot: OfflineSnapshotV2,
  secretHex: string,
  nonce: Uint8Array,
): string {
  const json = JSON.stringify(snapshot);
  if (utf8ToBytes(json).length > OFFLINE_PLAINTEXT_LIMIT)
    throw new Error("Data offline terlalu besar untuk disimpan.");
  const ciphertext = gcm(hexToBytes(secretHex), nonce).encrypt(
    utf8ToBytes(json),
  );
  return `${bytesToHex(nonce)}:${bytesToHex(ciphertext)}`;
}

export function openOfflineSnapshot(
  payload: string,
  secretHex: string,
): OfflineSnapshotV2 {
  const [nonce, ciphertext, extra] = payload.split(":");
  if (!nonce || !ciphertext || extra)
    throw new Error("Payload offline tidak lengkap.");
  const parsed: unknown = JSON.parse(
    bytesToUtf8(
      gcm(hexToBytes(secretHex), hexToBytes(nonce)).decrypt(
        hexToBytes(ciphertext),
      ),
    ),
  );
  if (!isOfflineSnapshot(parsed))
    throw new Error("Versi data offline tidak didukung.");
  return parsed;
}
