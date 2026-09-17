import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ServiceDetail, SetlistItem } from "../lib/church";
import type { ClickSettings } from "../domain/metronome";
import { Feedback } from "./ui";
import { songLabel } from "../domain/songLabel";

type Props = {
  detail: ServiceDetail;
  item: SetlistItem;
  index: number;
  settings: ClickSettings | null;
  beat: number | null;
  playing: boolean;
  starting: boolean;
  audioActive?: boolean;
  view: "setlist" | "practice";
  busy: boolean;
  error: string;
  audioAvailable: boolean;
  audioNotice: string;
  onSelect(id: string): void;
  onStart(): void;
  onStop(): void;
  onView(view: "setlist" | "practice"): void;
  onAdd(): void;
  children: React.ReactNode;
};

// A single controlled view: Setlist includes authorized editing; Practice is
// playback-only. All switches use the parent's dirty/save and audio safeguards.
export function MetronomeConsole(props: Props) {
  const { detail, item, index, settings, beat, playing, starting, view, busy } =
    props;
  const setlist = view === "setlist";
  const editing = setlist && detail.can_edit;
  const toggleView = () => props.onView(setlist ? "practice" : "setlist");
  const running = playing || starting || !!props.audioActive;
  return (
    <View style={s.root}>
      <View style={s.top}>
        <IconButton
          label={setlist ? "Tampilkan Practice" : "Tampilkan Setlist"}
          icon="▦"
          onPress={toggleView}
          disabled={busy}
          selected={setlist}
        />
        <Text style={s.logo} accessibilityRole="header">
          METRONOME
        </Text>
        <IconButton
          label="Informasi metronome"
          icon="ⓘ"
          onPress={() =>
            Alert.alert(
              "Metronome pSalmo",
              "Setlist adalah halaman daftar sekaligus edit lagu untuk PIC/admin atau editor WL/MD yang berwenang. Practice khusus bermain, tanpa pengaturan edit. Masuk Setlist untuk mengedit menghentikan klik; perubahan belum disimpan dikonfirmasi sebelum pindah halaman/lagu. BPM dihitung per ketukan birama: 6/8 = enam klik not 1/8. Previous/Next menghentikan klik; lagu baru tidak mulai otomatis. Klik tetap berjalan saat pindah tab aplikasi atau layar terkunci. Gunakan Stop pada kontrol media atau panel bawah. Automator, Tracker, dan mute belum tersedia.",
            )
          }
        />
      </View>
      <View style={s.visualizer}>
        <View
          style={s.beats}
          accessibilityLabel={`Ketukan ${beat === null ? "berhenti" : beat + 1} dari ${settings?.beats ?? "belum diatur"}`}
        >
          {settings ? (
            Array.from({ length: settings.beats }, (_, number) => (
              <View
                key={number}
                style={[
                  s.beat,
                  number === 0 && s.accent,
                  beat === number && s.lit,
                ]}
              >
                <Text style={[s.beatText, beat === number && s.litText]}>
                  {number === 0 ? "›" : number + 1}
                </Text>
              </View>
            ))
          ) : (
            <Text style={s.muted}>
              Atur BPM dan birama untuk melihat ketukan.
            </Text>
          )}
        </View>
        <View style={s.status}>
          <View>
            <Text style={s.label}>KLIK</Text>
            <Text style={s.value}>
              {starting ? "Menyiapkan…" : playing ? "Aktif" : "Siap"}
            </Text>
          </View>
          <View>
            <Text style={s.label}>LAGU</Text>
            <Text style={s.value}>
              {index + 1} / {detail.items.length}
            </Text>
          </View>
          <Text style={s.statusMeter}>
            {settings ? `${settings.beats}/${settings.denominator}` : "—"}
          </Text>
        </View>
      </View>
      <View style={s.switches}>
        <Tab
          label="Setlist"
          selected={setlist}
          disabled={busy}
          onPress={() => props.onView("setlist")}
        />
        <Tab
          label="Practice"
          selected={!setlist}
          disabled={busy}
          onPress={() => props.onView("practice")}
        />
      </View>
      {setlist && running && <IconButton label="Stop metronome" icon="■" onPress={props.onStop} />}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.setlistHeader}>
          {editing && (
            <IconButton
              label="Tambah lagu ke ibadah"
              icon="+"
              disabled={busy}
              onPress={props.onAdd}
            />
          )}
          <Text style={s.setlistTitle} accessibilityRole="header">
            {detail.service.title}
          </Text>
          <IconButton
            label={setlist ? "Fokus pada lagu" : "Kembali ke daftar lagu"}
            icon={setlist ? "↗" : "▦"}
            onPress={toggleView}
            disabled={busy}
          />
        </View>
        {setlist && (
          <View>
            {detail.items.map((song, position) => (
              <Pressable
                key={song.id}
                accessibilityRole="button"
                accessibilityLabel={`${position + 1}. ${songLabel(song.proposed_title, song.key)}, ${song.bpm ?? "BPM belum diatur"}${song.bpm ? " BPM" : ""}, ${song.time_signature || "birama belum diatur"}`}
                accessibilityState={{
                  selected: song.id === item.id,
                  disabled: busy,
                }}
                disabled={busy}
                onPress={() => {
                  if (song.id !== item.id) props.onSelect(song.id);
                }}
                style={({ pressed }) => [
                  s.track,
                  song.id === item.id && s.selectedTrack,
                  pressed && s.pressed,
                ]}
              >
                <Text style={s.trackNumber}>{position + 1}.</Text>
                <Text
                  style={[s.trackTitle, song.id === item.id && s.selectedTitle]}
                >
                  {songLabel(song.proposed_title, song.key)}
                </Text>
                <View style={s.trackSettings}>
                  <Text style={s.trackBpm}>
                    {song.bpm ?? "—"} <Text style={s.small}>bpm</Text>
                  </Text>
                  <Text style={s.muted}>{song.time_signature || "—"}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        <View style={s.activeSong}>
          <Text style={s.label}>
            {editing ? "PENGATURAN LAGU" : "LAGU PILIHAN"}
          </Text>
          <Text style={s.songTitle} accessibilityRole="header">
            {songLabel(item.proposed_title, item.key)}
          </Text>
          <Text style={s.muted}>
            {[item.artist, item.key ? `Nada ${item.key}` : ""]
              .filter(Boolean)
              .join(" · ") || "Latihan ibadah"}
          </Text>
          <View style={s.tempo}>
            <Text style={s.bpm}>{item.bpm ?? "—"}</Text>
            <View>
              <Text style={s.label}>BPM</Text>
              <Text style={s.value}>{item.time_signature || "—"}</Text>
            </View>
          </View>
          {!editing ? (
            <>
              <Text style={s.label}>CATATAN</Text>
              <Text style={s.notes}>{item.notes || "Belum ada catatan."}</Text>
              {!!item.structure.length && (
                <Text style={s.notes}>
                  {item.structure
                    .map(
                      (part) =>
                        `${part.section}${part.bars ? ` (${part.bars} bar)` : ""}`,
                    )
                    .join(" → ")}
                </Text>
              )}
            </>
          ) : (
            <View style={s.editor}>{props.children}</View>
          )}
        </View>
        {!props.audioAvailable && (
          <Text style={s.muted}>{props.audioNotice}</Text>
        )}
        <View style={s.feedback}>
          <Feedback error={props.error} />
        </View>
      </ScrollView>
      {!setlist && (
        <View style={s.dock}>
          <Text style={s.label}>
            PRACTICE ·{" "}
            {running ? "STOP UNTUK BERHENTI" : "TEKAN PLAY UNTUK MULAI"}
          </Text>
          <View style={s.transport}>
            <Transport
              label="Lagu sebelumnya"
              icon="|‹"
              disabled={index === 0 || busy}
              onPress={() => props.onSelect(detail.items[index - 1].id)}
            />
            <Transport
              label={running ? "Stop metronome" : "Mulai metronome"}
              icon={running ? "■" : "▶"}
              large
              disabled={!running && (!settings || !props.audioAvailable)}
              onPress={running ? props.onStop : props.onStart}
            />
            <Transport
              label="Lagu berikutnya"
              icon="›|"
              disabled={index === detail.items.length - 1 || busy}
              onPress={() => props.onSelect(detail.items[index + 1].id)}
            />
          </View>
          <Text style={s.hint}>
            Previous / Next berhenti dulu · tidak mulai otomatis
          </Text>
        </View>
      )}
    </View>
  );
}

function IconButton({
  label,
  icon,
  onPress,
  disabled = false,
  selected = false,
}: {
  label: string;
  icon: string;
  onPress(): void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconButton,
        selected && s.iconSelected,
        disabled && s.disabled,
        pressed && s.pressed,
      ]}
    >
      <Text style={s.icon}>{icon}</Text>
    </Pressable>
  );
}
function Tab({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.tab, selected && s.tabSelected, disabled && s.disabled]}
    >
      <Text style={[s.tabText, selected && s.selectedTitle]}>{label}</Text>
    </Pressable>
  );
}
function Transport({
  label,
  icon,
  onPress,
  disabled,
  large = false,
}: {
  label: string;
  icon: string;
  onPress(): void;
  disabled: boolean;
  large?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.transportButton,
        large && s.transportLarge,
        disabled && s.disabled,
        pressed && s.pressed,
      ]}
    >
      <Text style={[s.transportIcon, large && s.transportLargeIcon]}>
        {icon}
      </Text>
    </Pressable>
  );
}

const orange = "#ff9b45";
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#192026" },
  top: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  logo: {
    flex: 1,
    color: orange,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 1.5,
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  iconSelected: { backgroundColor: "#35302a" },
  icon: { color: orange, fontSize: 28, fontWeight: "600" },
  visualizer: { paddingHorizontal: 20, paddingBottom: 14, gap: 16 },
  beats: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 8,
  },
  beat: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#52504a",
    backgroundColor: "#302d28",
    alignItems: "center",
    justifyContent: "center",
  },
  accent: { borderColor: orange },
  lit: {
    backgroundColor: orange,
    borderColor: "#ffd6b3",
    elevation: 6,
    shadowColor: orange,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  beatText: { color: "#c6b59e", fontSize: 22, fontWeight: "700" },
  litText: { color: "#352012" },
  status: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    color: "#b7c1c9",
  },
  value: { fontSize: 17, lineHeight: 26, color: "#f5f7fa", fontWeight: "600" },
  statusMeter: { color: orange, fontSize: 24, fontWeight: "700" },
  switches: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 10,
  },
  tab: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#252f38",
  },
  tabSelected: { backgroundColor: "#3b3025" },
  tabText: { color: "#d8e0e6", fontSize: 15, fontWeight: "600" },
  scroll: { flex: 1 },
  content: { paddingBottom: 20 },
  setlistHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#36414b",
    minHeight: 60,
  },
  setlistTitle: {
    flex: 1,
    color: "#e4eaf0",
    fontSize: 18,
    fontWeight: "700",
    paddingVertical: 12,
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: "#303b45",
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  selectedTrack: { backgroundColor: "#342b23", borderLeftColor: orange },
  trackNumber: { color: "#b7c1c9", fontSize: 16 },
  trackTitle: {
    flex: 1,
    color: "#edf1f5",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
  },
  selectedTitle: { color: orange },
  trackSettings: { alignItems: "flex-end", gap: 3 },
  trackBpm: { color: "#eef3f8", fontSize: 17, fontWeight: "700" },
  small: { fontSize: 11, fontWeight: "400" },
  activeSong: { padding: 20, gap: 8 },
  songTitle: { color: "#ffffff", fontSize: 25, fontWeight: "700" },
  tempo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 4,
  },
  bpm: { color: orange, fontSize: 64, fontWeight: "800" },
  muted: { color: "#b7c1c9", fontSize: 14, lineHeight: 21 },
  notes: { color: "#e1e7ed", fontSize: 16, lineHeight: 24 },
  editor: {
    backgroundColor: "#f4f7f8",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  feedback: {
    backgroundColor: "#f4f7f8",
    borderRadius: 8,
    marginHorizontal: 16,
  },
  dock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderColor: "#36414b",
    backgroundColor: "#151b20",
  },
  transport: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
  },
  transportButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#3A3A3A",
    alignItems: "center",
    justifyContent: "center",
  },
  transportLarge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: orange,
  },
  transportIcon: { color: "white", fontSize: 30, fontWeight: "800" },
  transportLargeIcon: { fontSize: 38 },
  hint: { color: "#b7c1c9", fontSize: 11, textAlign: "center" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
});
