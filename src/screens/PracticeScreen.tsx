import React, { useEffect, useRef, useState } from "react";
import { Alert, AppState, View } from "react-native";
import { MetronomeConsole } from "../components/MetronomeConsole";
import { TimeSignaturePicker } from "../components/TimeSignaturePicker";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Routes } from "../navigation/types";
import * as api from "../lib/church";
import { clickSettings, tappedBpm, ClickSettings, defaultMeter } from "../domain/metronome";
import { useClickPlayer } from "../context/ClickPlayerContext";
import { nativeClickAvailable, nativeClickNotice } from "../lib/clickAudio";
import {
  Body,
  Button,
  Card,
  Feedback,
  Field,
  Title,
  useAction,
  useLoad,
} from "../components/ui";

export function PracticeScreen({
  route,
  navigation,
}: NativeStackScreenProps<Routes, "Practice">) {
  const state = useLoad(
    () => api.getServiceDetail(route.params.serviceId),
    [route.params.serviceId],
  );
  return (
    <View style={{ flex: 1, backgroundColor: "#192026" }}>
      <Feedback loading={state.loading} error={state.error} />
      {state.error && (
        <Button title="Coba muat ulang" onPress={() => void state.reload()} />
      )}
      {state.data && (
        <PracticeSession
          detail={state.data}
          reload={state.reload}
          onAdd={() =>
            navigation.navigate("AddSongs", {
              serviceId: route.params.serviceId,
            })
          }
        />
      )}
    </View>
  );
}

function PracticeSession({
  detail,
  reload,
  onAdd,
}: {
  onAdd: () => void;
  detail: api.ServiceDetail;
  reload: () => Promise<void>;
}) {
  const player = useClickPlayer();
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  const [selectedId, setSelectedId] = useState(
    player.track?.serviceId === detail.service.id
      ? player.track.itemId
      : detail.items[0]?.id,
  );
  const [view, setView] = useState<"setlist" | "practice">(
    player.track?.serviceId === detail.service.id ? "practice" : "setlist",
  );
  const playing =
    player.playing &&
    player.track?.serviceId === detail.service.id &&
    player.track.itemId === selectedId;
  const starting = player.starting;
  const [beat, setBeat] = useState<number | null>(null);
  const notice = player.notice;
  const [editorState, setEditorState] = useState({ dirty: false, busy: false });
  const stop = player.stop;
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!playing || !isFocused || !appActive) {
      setBeat(null);
      return;
    }
    const timer = setInterval(() => setBeat(player.beat()), 40);
    return () => clearInterval(timer);
  }, [playing, isFocused, appActive, player.beat]);
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
        {detail.can_edit && (
          <Button title="Tambah lagu ke ibadah" onPress={onAdd} />
        )}
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
      settings &&
      !starting &&
      isFocused &&
      AppState.currentState === "active"
    )
      await player.start(detail.service.id, item.id);
  }
  function transition(change: () => void, stopAudio = true) {
    if (editorState.busy) return;
    const proceed = () => {
      if (stopAudio) stop();
      setEditorState({ dirty: false, busy: false });
      change();
    };
    if (view === "setlist" && detail.can_edit && editorState.dirty)
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
    <MetronomeConsole
      detail={detail}
      item={item}
      index={index}
      settings={playing && player.track ? player.track.settings : settings}
      beat={beat}
      playing={playing}
      starting={starting}
      view={view}
      busy={editorState.busy}
      error={settingsError || notice}
      audioAvailable={nativeClickAvailable}
      audioNotice={nativeClickNotice}
      onSelect={select}
      onStart={() => void start()}
      onStop={() => stop()}
      onView={(next) => {
        if (next !== view) transition(() => setView(next), detail.can_edit);
      }}
      onAdd={() => transition(onAdd)}
    >
      {view === "setlist" && detail.can_edit && (
        <ClickEditor
          key={`${item.id}:${item.bpm}:${item.time_signature}:${item.notes}`}
          item={item}
          reload={reload}
          onStateChange={setEditorState}
        />
      )}
    </MetronomeConsole>
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
  const [signature, setSignature] = useState(defaultMeter(item.time_signature));
  const [notes, setNotes] = useState(item.notes || "");
  const taps = useRef<number[]>([]);
  const action = useAction(reload);
  const dirty =
    bpm !== (item.bpm?.toString() || "") ||
    signature !== defaultMeter(item.time_signature) ||
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
      <TimeSignaturePicker
        label="Birama"
        value={signature}
        onChange={setSignature}
        disabled={action.busy}
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
        Pengaturan disimpan untuk aransemen ibadah ini, bukan Song Bank.
        Practice memakai pengaturan tersimpan; simpan perubahan terlebih dahulu.
      </Body>
    </>
  );
}
