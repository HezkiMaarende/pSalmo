import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Routes } from "../navigation/types";
import * as api from "../lib/church";
import { clickSettings, tappedBpm, ClickSettings } from "../domain/metronome";
import { Playback } from "../domain/playback";
import {
  createClickRun,
  nativeClickAvailable,
  nativeClickNotice,
} from "../lib/clickAudio";
import {
  Body,
  Button,
  Card,
  colors,
  Feedback,
  Field,
  Page,
  styles,
  Title,
  useAction,
  useLoad,
} from "../components/ui";

export function PracticeScreen({
  route,
}: NativeStackScreenProps<Routes, "Practice">) {
  const state = useLoad(
    () => api.getServiceDetail(route.params.serviceId),
    [route.params.serviceId],
  );
  return (
    <Page>
      <Feedback loading={state.loading} error={state.error} />
      {state.error && (
        <Button title="Coba muat ulang" onPress={() => void state.reload()} />
      )}
      {state.data && (
        <PracticeSession detail={state.data} reload={state.reload} />
      )}
    </Page>
  );
}

function PracticeSession({
  detail,
  reload,
}: {
  detail: api.ServiceDetail;
  reload: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(detail.items[0]?.id);
  const [mode, setMode] = useState<"edit" | "play">("play");
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const focused = useRef(false);
  const startingRef = useRef(false);
  const startRequest = useRef(0);
  const [editorState, setEditorState] = useState({ dirty: false, busy: false });
  const transport = useRef<Playback<ClickSettings> | null>(null);
  if (!transport.current)
    transport.current = new Playback((settings, current) =>
      createClickRun(settings, current, (message) => stop(message)),
    );
  const stop = useCallback((message = "") => {
    transport.current?.stop();
    ++startRequest.current;
    startingRef.current = false;
    setStarting(false);
    setPlaying(false);
    setBeat(null);
    setNotice(message);
  }, []);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        stop();
      };
    }, [stop]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active")
        stop(
          "Pemutar dihentikan saat aplikasi tidak aktif. Tekan Start saat kembali.",
        );
    });
    return () => subscription.remove();
  }, [stop]);
  // Refreshed content/permissions must never continue an old downloaded track.
  useEffect(() => {
    stop();
  }, [detail, stop]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setBeat(transport.current?.beat() ?? null),
      40,
    );
    return () => clearInterval(timer);
  }, [playing]);
  const index = Math.max(
    0,
    detail.items.findIndex((song) => song.id === selectedId),
  );
  const item = detail.items[index];
  if (!item)
    return (
      <Card>
        <Title>Belum ada lagu</Title>
        <Body>Tambahkan daftar lagu sebelum memulai latihan.</Body>
      </Card>
    );
  let settings: ClickSettings | null = null;
  let settingsError = "";
  try {
    settings = clickSettings(item.bpm, item.time_signature);
  } catch (error) {
    settingsError = error instanceof Error ? error.message : String(error);
  }
  async function start() {
    if (
      !settings ||
      startingRef.current ||
      !focused.current ||
      AppState.currentState !== "active"
    )
      return;
    startingRef.current = true;
    const ticket = ++startRequest.current;
    setStarting(true);
    setNotice("");
    try {
      const started = await transport.current!.start(settings);
      if (started && focused.current && ticket === startRequest.current)
        setPlaying(true);
    } catch (error) {
      if (focused.current && ticket === startRequest.current)
        setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      if (ticket === startRequest.current) {
        startingRef.current = false;
        if (focused.current) setStarting(false);
      }
    }
  }
  function transition(change: () => void) {
    if (editorState.busy) return;
    const proceed = () => {
      stop();
      setEditorState({ dirty: false, busy: false });
      change();
    };
    if (mode === "edit" && editorState.dirty)
      Alert.alert(
        "Perubahan belum disimpan",
        "Lanjut tanpa menyimpan pengaturan latihan?",
        [
          { text: "Kembali", style: "cancel" },
          { text: "Abaikan perubahan", style: "destructive", onPress: proceed },
        ],
      );
    else proceed();
  }
  function select(id: string) {
    transition(() => setSelectedId(id));
  }
  return (
    <>
      <Body muted>
        {detail.service.title} · {index + 1}/{detail.items.length}
      </Body>
      <View style={styles.row}>
        <Button
          title={mode === "play" ? "Play · aktif" : "Masuk Play"}
          disabled={mode === "play" || editorState.busy}
          onPress={() => transition(() => setMode("play"))}
        />
        {detail.can_edit && (
          <Button
            title={mode === "edit" ? "Edit · aktif" : "Masuk Edit"}
            disabled={mode === "edit"}
            onPress={() => {
              stop();
              setMode("edit");
            }}
          />
        )}
      </View>
      <Card>
        <Title>{item.proposed_title || "Lagu"}</Title>
        <Body muted>
          {item.artist || ""}
          {item.key ? ` · Nada ${item.key}` : ""}
        </Body>
        <Text style={practice.bpm}>
          {item.bpm ?? "—"}{" "}
          <Text style={practice.unit}>
            BPM · {item.time_signature || "birama belum diatur"}
          </Text>
        </Text>
        {settings && (
          <View
            style={styles.row}
            accessibilityLabel={`Ketukan ${beat === null ? "berhenti" : beat + 1} dari ${settings.beats}`}
          >
            {Array.from({ length: settings.beats }, (_, number) => (
              <View
                key={number}
                style={[
                  practice.beat,
                  number === 0 && practice.accent,
                  beat === number && practice.lit,
                ]}
              >
                <Text
                  style={[
                    practice.beatText,
                    beat === number && { color: "white" },
                  ]}
                >
                  {number + 1}
                </Text>
              </View>
            ))}
          </View>
        )}
        <Body muted>
          BPM per ketukan birama: 6/8 = enam klik not 1/8. Aksen pada ketukan
          pertama.
        </Body>
        {!nativeClickAvailable && <Body muted>{nativeClickNotice}</Body>}
        <Feedback error={settingsError || notice} />
        {mode === "play" ? (
          <>
            <Button
              title={playing || starting ? "Stop" : "Start"}
              disabled={
                !playing && !starting && (!settings || !nativeClickAvailable)
              }
              onPress={() => (playing || starting ? stop() : void start())}
            />
            <Button
              title={
                index === detail.items.length - 1
                  ? "Lagu terakhir"
                  : "Lagu berikutnya →"
              }
              disabled={index === detail.items.length - 1}
              onPress={() => select(detail.items[index + 1].id)}
            />
            <Body muted>
              Next menghentikan klik. Lagu berikutnya tidak mulai otomatis.
              Keluar, berganti tab, atau mengunci layar juga menghentikan
              pemutar pada versi ini.
            </Body>
            <Title>Catatan</Title>
            <Body>{item.notes || "Belum ada catatan."}</Body>
            {!!item.structure.length && (
              <Body>
                {item.structure
                  .map(
                    (part) =>
                      `${part.section}${part.bars ? ` (${part.bars} bar)` : ""}`,
                  )
                  .join(" → ")}
              </Body>
            )}
          </>
        ) : (
          <ClickEditor
            key={`${item.id}:${item.bpm}:${item.time_signature}:${item.notes}`}
            item={item}
            reload={reload}
            onStateChange={setEditorState}
          />
        )}
      </Card>
      {mode === "edit" && (
        <Card>
          <Title>Daftar latihan</Title>
          {detail.items.map((song, position) => (
            <Button
              key={song.id}
              title={`${position + 1}. ${song.proposed_title || "Lagu"}`}
              disabled={song.id === item.id || editorState.busy}
              onPress={() => select(song.id)}
            />
          ))}
        </Card>
      )}
      {!detail.can_edit && (
        <Body muted>
          Pengaturan hanya dapat diubah PIC/admin atau editor WL/MD yang
          bertugas.
        </Body>
      )}
    </>
  );
}

function ClickEditor({
  item,
  reload,
  onStateChange,
}: {
  item: api.SetlistItem;
  reload: () => Promise<void>;
  onStateChange: (state: { dirty: boolean; busy: boolean }) => void;
}) {
  const [bpm, setBpm] = useState(item.bpm?.toString() || "");
  const [signature, setSignature] = useState(item.time_signature || "");
  const [notes, setNotes] = useState(item.notes || "");
  const taps = useRef<number[]>([]);
  const action = useAction(reload);
  const dirty =
    bpm !== (item.bpm?.toString() || "") ||
    signature !== (item.time_signature || "") ||
    notes !== (item.notes || "");
  useEffect(() => {
    onStateChange({ dirty, busy: action.busy });
  }, [dirty, action.busy, onStateChange]);
  function tap() {
    const now = performance.now();
    if (
      taps.current.length &&
      now - taps.current[taps.current.length - 1] > 3000
    )
      taps.current = [];
    taps.current = [...taps.current, now].slice(-6);
    const next = tappedBpm(taps.current);
    if (next !== null) setBpm(String(next));
  }
  return (
    <>
      <Field label="BPM (20–400)" value={bpm} onChangeText={setBpm} />
      <Button title="Tap tempo" disabled={action.busy} onPress={tap} />
      <Field
        label="Birama (contoh 4/4, 3/4, 6/8)"
        value={signature}
        onChangeText={setSignature}
      />
      <Field
        label="Catatan latihan"
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <Feedback error={action.error} />
      <Button
        title={action.busy ? "Menyimpan…" : "Simpan pengaturan lagu"}
        disabled={action.busy}
        onPress={() =>
          void action.run(async () => {
            clickSettings(api.bpmValue(bpm), api.signatureValue(signature));
            await api.saveClickSettings(item.id, bpm, signature, notes);
          })
        }
      />
      <Body muted>
        Pengaturan disimpan untuk aransemen ibadah ini, bukan Song Bank. Masuk
        Play memakai pengaturan tersimpan; simpan perubahan terlebih dahulu.
      </Body>
    </>
  );
}
const practice = StyleSheet.create({
  bpm: { fontSize: 56, fontWeight: "700", color: colors.ink },
  unit: { fontSize: 17, fontWeight: "400" },
  beat: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  accent: { borderColor: colors.teal, borderWidth: 2 },
  lit: { backgroundColor: colors.teal },
  beatText: { color: colors.ink, fontSize: 18, fontWeight: "600" },
});
