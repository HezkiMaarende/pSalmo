import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useChurch } from "./ChurchContext";
import { getServiceDetail } from "../lib/church";
import { clickSettings, ClickSettings } from "../domain/metronome";
import { Playback } from "../domain/playback";
import { createClickRun } from "../lib/clickAudio";
import { Body, Button, colors } from "../components/ui";

type Track = {
  serviceId: string;
  itemId: string;
  title: string;
  serviceTitle: string;
  settings: ClickSettings;
};
type State = {
  track: Track | null;
  starting: boolean;
  playing: boolean;
  notice: string;
};
type Player = State & {
  start(serviceId: string, itemId: string): Promise<void>;
  stop(message?: string): void;
  beat(): number | null;
};
const Context = createContext<Player>(null!);
export const useClickPlayer = () => useContext(Context);

// One owner above all navigation stacks. Unmounting a page, tab changes and
// AppState background transitions never dispose an active native click loop.
export function ClickPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const church = useChurch();
  const account = useRef(church);
  account.current = church;
  const [state, setState] = useState<State>({
    track: null,
    starting: false,
    playing: false,
    notice: "",
  });
  const active = useRef<Track | null>(null);
  const request = useRef(0);
  const playback = useRef<Playback<Track> | null>(null);
  const stop = useCallback((notice = "") => {
    ++request.current;
    active.current = null;
    playback.current?.stop();
    setState({ track: null, starting: false, playing: false, notice });
  }, []);
  if (!playback.current)
    playback.current = new Playback((track, current) =>
      createClickRun(
        track.settings,
        current,
        stop,
        track.title,
        track.serviceTitle,
      ),
    );
  const start = useCallback(
    async (serviceId: string, itemId: string) => {
      stop();
      const ticket = request.current;
      const userId = account.current.session?.user.id;
      if (
        !userId ||
        !account.current.membership ||
        AppState.currentState !== "active"
      )
        return;
      const current = () =>
        ticket === request.current &&
        account.current.session?.user.id === userId &&
        !!account.current.membership;
      setState((s) => ({ ...s, starting: true }));
      try {
        // Never start from stale navigation data; RLS checks current membership,
        // assignment and approval before every explicit Start.
        const detail = await getServiceDetail(serviceId);
        if (!current()) return;
        if (AppState.currentState !== "active")
          throw new Error("Kembali ke aplikasi lalu tekan Start.");
        const item = detail.items.find((song) => song.id === itemId);
        if (!item)
          throw new Error(
            "Lagu tidak lagi tersedia. Muat ulang daftar ibadah.",
          );
        const track: Track = {
          serviceId,
          itemId,
          title: item.proposed_title || "Lagu",
          serviceTitle: detail.service.title,
          settings: clickSettings(item.bpm, item.time_signature),
        };
        active.current = track;
        setState({ track, starting: true, playing: false, notice: "" });
        const started = await playback.current!.start(track);
        if (current()) {
          active.current = started ? track : null;
          setState({
            track: started ? track : null,
            starting: false,
            playing: started,
            notice: "",
          });
        }
      } catch (error) {
        if (current())
          stop(error instanceof Error ? error.message : String(error));
      }
    },
    [stop],
  );
  useEffect(() => {
    // Changing account or losing membership is different from page lifecycle.
    stop();
  }, [church.session?.user.id, stop]);
  useEffect(() => {
    if (!church.membership) stop();
  }, [church.membership, stop]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status !== "active" || !active.current) return;
      const ticket = request.current;
      const track = active.current;
      void getServiceDetail(track.serviceId)
        .then((detail) => {
          if (
            ticket === request.current &&
            !detail.items.some((item) => item.id === track.itemId)
          )
            stop("Lagu tidak lagi tersedia.");
        })
        .catch(() => {
          if (ticket === request.current)
            stop(
              "Akses ibadah tidak dapat diverifikasi. Tekan Start setelah koneksi/akses pulih.",
            );
        });
    });
    return () => {
      subscription.remove();
      stop();
    };
  }, [stop]);
  return (
    <Context.Provider
      value={{
        ...state,
        start,
        stop,
        beat: () => playback.current?.beat() ?? null,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function ClickPlayerBar() {
  const player = useClickPlayer();
  if (!player.playing && !player.starting) return null;
  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ backgroundColor: colors.background }}
    >
      <View
        style={{
          padding: 12,
          borderTopWidth: 1,
          borderColor: colors.border,
          gap: 6,
        }}
      >
        <Body>
          {player.starting ? "Menyiapkan klik…" : "Klik aktif"}
          {player.track
            ? ` · ${player.track.title} · ${player.track.settings.bpm} BPM`
            : ""}
        </Body>
        <Button title="Stop metronome" onPress={() => player.stop()} />
      </View>
    </SafeAreaView>
  );
}
