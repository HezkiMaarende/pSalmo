import React, { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Routes } from "../navigation/types";
import { useChurch } from "../context/ChurchContext";
import * as api from "../lib/church";
import { jakartaDay, monthSundays, dateLabel } from "../domain/calendar";
import {
  Page,
  Card,
  Title,
  Body,
  Button,
  Field,
  Feedback,
  styles,
  useLoad,
  useAction,
} from "../components/ui";
import { VideoReference } from "../components/VideoReference";
import { MonthControl } from "./WeeklyScreens";
type Props<K extends keyof Routes> = NativeStackScreenProps<Routes, K>;
function useLibraryEditor() {
  const { membership } = useChurch();
  return (
    !!membership && (membership.role !== "member" || membership.song_editor)
  );
}
export function LibraryScreen({ navigation }: Props<"Library">) {
  const [query, setQuery] = useState("");
  const state = useLoad(api.listSongs, []);
  const editor = useLibraryEditor();
  return (
    <Page>
      <Title>Song Bank</Title>
      <Field label="Cari judul / artis" value={query} onChangeText={setQuery} />
      {editor && (
        <Button
          title="Tambah lagu baru"
          onPress={() => navigation.navigate("SongEdit")}
        />
      )}
      <Feedback loading={state.loading} error={state.error} />
      {state.data && !state.data.length && (
        <Body muted>Song Bank gereja masih kosong.</Body>
      )}
      {state.data
        ?.filter((s) =>
          `${s.title} ${s.artist || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((song) => (
          <Card key={song.id}>
            <Title>{song.title}</Title>
            <Body muted>
              {[
                song.artist,
                song.default_key,
                song.default_bpm && `${song.default_bpm} BPM`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Body>
            <Button
              title="Lihat lagu"
              onPress={() => navigation.navigate("Song", { id: song.id })}
            />
          </Card>
        ))}
    </Page>
  );
}
export function SongScreen({ route, navigation }: Props<"Song">) {
  const state = useLoad(() => api.getSong(route.params.id), [route.params.id]);
  const editor = useLibraryEditor();
  const song = state.data;
  return (
    <Page>
      <Feedback loading={state.loading} error={state.error} />
      {song && (
        <>
          <Title>{song.title}</Title>
          <Body>{song.artist || "Artis belum diisi"}</Body>
          <Body muted>
            {[
              song.default_key && `Key ${song.default_key}`,
              song.default_bpm && `${song.default_bpm} BPM`,
              song.default_time_signature,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Body>
          {editor && (
            <View style={styles.row}>
              <Button
                title="Edit lagu"
                onPress={() => navigation.navigate("SongEdit", { id: song.id })}
              />
              <Button
                title="Tambahkan ke ibadah"
                onPress={() =>
                  navigation.navigate("Targets", { songId: song.id })
                }
              />
            </View>
          )}
          <Card>
            <Title>Lirik</Title>
            <Body>{song.lyrics || "Lirik belum tersedia."}</Body>
          </Card>
          <Card>
            <Title>Referensi YouTube</Title>
            {song.song_references.map((r, i) => (
              <VideoReference key={r.id || i} label={r.label} url={r.url} />
            ))}
            {!song.song_references.length && (
              <Body muted>Belum ada referensi.</Body>
            )}
          </Card>
          {(song.writer_credits || song.copyright_notice) && (
            <Card>
              <Body muted>{song.writer_credits}</Body>
              <Body muted>{song.copyright_notice}</Body>
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
export function SongEditScreen({ route, navigation }: Props<"SongEdit">) {
  const id = route.params?.id;
  const editor = useLibraryEditor();
  const state = useLoad(async () => (id ? api.getSong(id) : null), [id]);
  return (
    <Page>
      <Title>{id ? "Edit lagu" : "Lagu baru"}</Title>
      <Feedback loading={state.loading} error={state.error} />
      {!editor ? (
        <Body>Akses editor diperlukan.</Body>
      ) : (
        !state.loading &&
        !state.error && (
          <SongForm
            key={id || "new"}
            song={state.data}
            done={(songId) => navigation.replace("Song", { id: songId })}
          />
        )
      )}
    </Page>
  );
}
const empty: api.SongInput = {
  title: "",
  artist: "",
  key: "",
  bpm: "",
  time_signature: "",
  lyrics: "",
  writer_credits: "",
  copyright_notice: "",
};
function SongForm({
  song,
  done,
}: {
  song: api.Song | null;
  done: (id: string) => void;
}) {
  const [input, setInput] = useState<api.SongInput>(
    song
      ? {
          title: song.title,
          artist: song.artist || "",
          key: song.default_key || "",
          bpm: song.default_bpm?.toString() || "",
          time_signature: song.default_time_signature || "",
          lyrics: song.lyrics,
          writer_credits: song.writer_credits || "",
          copyright_notice: song.copyright_notice || "",
        }
      : empty,
  );
  const [refs, setRefs] = useState<api.Reference[]>(
    song?.song_references.map((r) => ({ label: r.label, url: r.url })) || [],
  );
  const a = useAction();
  const labels: Record<keyof api.SongInput, string> = {
    title: "Judul",
    artist: "Artis",
    key: "Key dasar",
    bpm: "BPM dasar (20–400)",
    time_signature: "Birama dasar (4/4)",
    lyrics: "Lirik polos · gunakan judul bagian seperti [Verse 1]",
    writer_credits: "Penulis / atribusi",
    copyright_notice: "Informasi hak cipta",
  };
  function move(index: number, offset: number) {
    const next = [...refs];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setRefs(next);
  }
  return (
    <>
      <Card>
        {(Object.keys(labels) as (keyof api.SongInput)[]).map((k) => (
          <Field
            key={k}
            label={labels[k]}
            value={input[k]}
            onChangeText={(v) => setInput({ ...input, [k]: v })}
            multiline={k === "lyrics"}
          />
        ))}
        <Body muted>
          Perubahan library tidak mengubah aransemen ibadah yang sudah
          ditambahkan. Chord ditulis di aransemen ibadah, bukan di library.
        </Body>
      </Card>
      <Title>Referensi YouTube berurutan</Title>
      {refs.map((r, i) => (
        <Card key={i}>
          <Field
            label={`Label video ${i + 1}`}
            value={r.label}
            onChangeText={(v) =>
              setRefs(
                refs.map((ref, n) => (n === i ? { ...ref, label: v } : ref)),
              )
            }
          />
          <Field
            label={`URL YouTube ${i + 1}`}
            value={r.url}
            onChangeText={(v) =>
              setRefs(
                refs.map((ref, n) => (n === i ? { ...ref, url: v } : ref)),
              )
            }
          />
          <View style={styles.row}>
            <Button
              title="↑ Referensi"
              disabled={i === 0}
              onPress={() => move(i, -1)}
            />
            <Button
              title="↓ Referensi"
              disabled={i === refs.length - 1}
              onPress={() => move(i, 1)}
            />
            <Button
              title="Hapus referensi"
              onPress={() => setRefs(refs.filter((_, n) => n !== i))}
            />
          </View>
        </Card>
      ))}
      <Button
        title="Tambah referensi video"
        onPress={() => setRefs([...refs, { label: "", url: "" }])}
      />
      <Feedback error={a.error} />
      <Button
        title="Simpan lagu"
        disabled={a.busy}
        onPress={() =>
          void a.run(async () =>
            done(await api.saveSong(song?.id || null, input, refs)),
          )
        }
      />
    </>
  );
}
export function TargetsScreen({ route, navigation }: Props<"Targets">) {
  const [month, setMonth] = useState(jakartaDay().slice(0, 7));
  const days = monthSundays(month);
  const state = useLoad(async () => {
    const services = await api.visibleServices(days[0], days[days.length - 1]);
    const eligibility = await Promise.all(
      services.map(async (s) => ({
        service: s,
        editable: (await api.getServiceDetail(s.id)).can_edit,
      })),
    );
    return eligibility
      .filter((entry) => entry.editable)
      .map((entry) => entry.service);
  }, [month]);
  const a = useAction();
  return (
    <Page>
      <Title>Pilih ibadah</Title>
      <MonthControl month={month} setMonth={setMonth} />
      <Body muted>Hanya ibadah yang boleh Anda edit yang ditampilkan.</Body>
      <Feedback loading={state.loading} error={state.error || a.error} />
      {state.data && !state.data.length && (
        <Body>Belum ada ibadah yang dapat Anda edit pada bulan ini.</Body>
      )}
      {state.data?.map((s) => (
        <Card key={s.id}>
          <Title>{s.title}</Title>
          <Body>
            {dateLabel(s.service_day)} · {s.status}
          </Body>
          <Button
            title="Tambahkan salinan lagu"
            disabled={a.busy}
            onPress={() =>
              void a.run(async () => {
                await api.addSongToSetlist(s.id, route.params.songId);
                navigation.navigate("Service", { id: s.id });
              })
            }
          />
        </Card>
      ))}
    </Page>
  );
}
