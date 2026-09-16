import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getMembership, getProfileName, Membership } from "../lib/church";
type State = {
  session: Session | null;
  membership: Membership | null;
  name: string;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};
const Context = createContext<State>(null!);
export const useChurch = () => useContext(Context);
export function ChurchProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const version = useRef(0);
  async function refresh() {
    const ticket = ++version.current;
    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (data.session) {
        const [m, n] = await Promise.all([
          getMembership(data.session.user.id),
          getProfileName(data.session.user.id),
        ]);
        if (ticket !== version.current) return;
        setSession(data.session);
        setMembership(m);
        setName(n);
      } else {
        if (ticket !== version.current) return;
        setSession(null);
        setMembership(null);
        setName("");
      }
      setError("");
    } catch (e) {
      if (ticket === version.current) {
        setError(e instanceof Error ? e.message : String(e));
        setMembership(null);
      }
    } finally {
      if (ticket === version.current) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        ++version.current;
        setMembership(null);
        setLoading(true);
      }
      setTimeout(() => void refresh(), 0);
    });
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh();
    });
    return () => {
      data.subscription.unsubscribe();
      listener.remove();
    };
  }, []);
  return (
    <Context.Provider
      value={{ session, membership, name, loading, error, refresh }}
    >
      {children}
    </Context.Provider>
  );
}
