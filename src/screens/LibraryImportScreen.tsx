import React, { useState } from "react";
import { Alert, View } from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { Routes } from "../navigation/types";
import { useChurch } from "../context/ChurchContext";
import * as api from "../lib/church";
import { pickLibraryTextFiles } from "../lib/libraryImportFiles";
import {
  duplicateCandidates,
  importEntries,
  ImportCandidate,
  LibraryIdentity,
  LibraryImportEntry,
  LibraryImportResult,
} from "../domain/libraryImport";
import {
  Body,
  Button,
  Card,
  Feedback,
  Field,
  Page,
  Title,
  useAction,
} from "../components/ui";
import { TimeSignaturePicker } from "../components/TimeSignaturePicker";

export function LibraryImportScreen({
  navigation,
}: NativeStackScreenProps<Routes, "LibraryImport">) {
  const { membership } = useChurch();
  const authorized =
    !!membership && (membership.role !== "member" || membership.song_editor);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [identities, setIdentities] = useState<LibraryIdentity[]>([]);
  const [warning, setWarning] = useState("");
  const [result, setResult] = useState<LibraryImportResult | null>(null);
  const [confirmed, setConfirmed] = useState<{
    id: string;
    entries: LibraryImportEntry[];
  } | null>(null);
  const action = useAction();
  const dirty = !!candidates.length || !!confirmed;
  const frozen = action.busy || !!confirmed || !authorized;
  const duplicates = duplicateCandidates(candidates, identities);
  usePreventRemove(dirty || action.busy, ({ data }) => {
    if (action.busy) return;
    Alert.alert(
      "Abaikan draft import?",
      confirmed
        ? "Permintaan mungkin sudah tersimpan. Periksa Song Bank sebelum memulai batch baru; retry memakai batch yang sama."
        : "File sumber tidak diubah. Pratinjau belum tersimpan akan hilang.",
      [
        { text: "Tetap di sini", style: "cancel" },
        {
          text: "Abaikan",
          style: "destructive",
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });
  function patch(id: string, values: Partial<ImportCandidate>) {
    setCandidates((current) => {
      const next = current.map((candidate) =>
        candidate.id === id ? { ...candidate, ...values } : candidate,
      );
      const dupe = duplicateCandidates(next, identities);
      return next.map((candidate) =>
        dupe.has(candidate.id) ? { ...candidate, selected: false } : candidate,
      );
    });
  }
  async function commit(batch: NonNullable<typeof confirmed>) {
    const response = await api.importLibrarySongs(batch.id, "", batch.entries);
    setResult(response);
    setCandidates([]);
    setConfirmed(null);
  }
  function reset() {
    setCandidates([]);
    setConfirmed(null);
    setWarning("");
  }
  return (
    <Page>
      <Title>Import dari ProPresenter</Title>
      <Body muted>
        Pilih satu lagu per file .txt, .pro atau .propresenter (format PP7).
        Teks dibaca lokal; tidak ada AI, upload file sumber, atau perubahan
        daftar ibadah. Periksa judul, lirik, dan attribution sebelum konfirmasi.
      </Body>
      <Body muted>
        Picker memerlukan APK baru setelah penambahan modul native: jalankan npm
        run build:android. APK lama tetap dapat membuka halaman lain.
      </Body>
      <Feedback loading={action.busy} error={action.error} />
      {!!warning && <Body>{warning}</Body>}
      {!authorized && <Body>Akses editor Song Bank tidak tersedia.</Body>}
      {authorized && (
        <Button
          title="Pilih .txt / .pro / .propresenter · maksimal 50"
          disabled={frozen || !!candidates.length}
          onPress={() =>
            void action.run(async () => {
              const picked = await pickLibraryTextFiles();
              if (!picked) return;
              const songs = await api.listSongIdentities();
              const dupes = duplicateCandidates(picked.candidates, songs);
              setIdentities(songs);
              setCandidates(
                picked.candidates.map((candidate) => ({
                  ...candidate,
                  selected: !dupes.has(candidate.id),
                })),
              );
              setWarning(picked.cleanupWarning);
              setResult(null);
            })
          }
        />
      )}
      {!!candidates.length && (
        <>
          <Body muted>
            Maks. 100KiB/file dan 2MiB/batch. Judul berasal dari nama file;
            pindahkan footer/kredit ke kolom yang tepat bila diperlukan. File
            gabungan harus dipisah per lagu. Native dibaca sebagai PP7, bukan
            bundle/media; file yang tidak didukung dapat diekspor sebagai .txt.
            Duplikat judul+artis dilewati, tidak ditimpa.
          </Body>
          {candidates.map((candidate, index) => (
            <Card key={candidate.id}>
              <Title>
                {index + 1}. {candidate.source_filename}
              </Title>
              {candidate.parse_warnings?.map((message, warningIndex) => (
                <Body key={warningIndex}>{message}</Body>
              ))}
              <Body>
                {duplicates.has(candidate.id)
                  ? "Duplikat — dilewati. Ubah judul/artis hanya jika memang lagu/versi berbeda."
                  : candidate.selected
                    ? "Dipilih"
                    : "Dilewati"}
              </Body>
              <Button
                title={
                  candidate.selected
                    ? `Lewati file ${index + 1}`
                    : `Pilih file ${index + 1}`
                }
                disabled={frozen || duplicates.has(candidate.id)}
                onPress={() =>
                  patch(candidate.id, { selected: !candidate.selected })
                }
              />
              {(
                [
                  ["title", "Judul Lagu"],
                  ["artist", "Artis"],
                  ["lyrics", "Lirik (pertahankan bagian dan pengulangan)"],
                  ["writer_credits", "Penulis / penerjemah"],
                  ["copyright_notice", "Copyright / attribution"],
                  ["key", "Key (opsional)"],
                  ["bpm", "BPM 20–400 (opsional)"],
                ] as const
              ).map(([field, label]) => (
                <Field
                  key={field}
                  label={`${label} · file ${index + 1}`}
                  value={candidate[field]}
                  onChangeText={(value) =>
                    patch(candidate.id, { [field]: value })
                  }
                  disabled={frozen}
                  multiline={[
                    "lyrics",
                    "writer_credits",
                    "copyright_notice",
                  ].includes(field)}
                />
              ))}
              <TimeSignaturePicker
                label={`Birama · file ${index + 1}`}
                value={candidate.time_signature}
                onChange={(value) =>
                  patch(candidate.id, { time_signature: value })
                }
                disabled={frozen}
              />
            </Card>
          ))}
          {!confirmed ? (
            <Button
              title={`Konfirmasi import ${candidates.filter((candidate) => candidate.selected).length} lagu baru`}
              disabled={
                frozen || !candidates.some((candidate) => candidate.selected)
              }
              onPress={() =>
                void action.run(async () => {
                  const entries = importEntries(candidates);
                  Alert.alert(
                    "Import ke Song Bank?",
                    "Simpan lagu yang dipilih setelah meninjau teks/attribution? Lagu existing tidak ditimpa.",
                    [
                      { text: "Batal", style: "cancel" },
                      {
                        text: "Import",
                        onPress: () =>
                          void action.run(async () => {
                            const batch = {
                              id: Crypto.randomUUID(),
                              entries,
                            };
                            setConfirmed(batch);
                            await commit(batch);
                          }),
                      },
                    ],
                  );
                })
              }
            />
          ) : (
            <>
              <Body muted>
                Batch dikunci untuk retry identik. Jika respons terputus, retry
                mengembalikan hasil batch yang sama, bukan membuat salinan baru.
              </Body>
              <Button
                title="Coba ulang batch yang sama"
                disabled={action.busy || !authorized}
                onPress={() => void action.run(() => commit(confirmed))}
              />
            </>
          )}
          <Button
            title="Abaikan pratinjau"
            disabled={action.busy}
            onPress={() =>
              Alert.alert(
                "Abaikan pratinjau?",
                confirmed
                  ? "Permintaan mungkin sudah tersimpan; periksa Song Bank. File sumber tidak diubah."
                  : "Draft akan hilang. File sumber dan Song Bank tidak diubah.",
                [
                  { text: "Batal", style: "cancel" },
                  { text: "Abaikan", style: "destructive", onPress: reset },
                ],
              )
            }
          />
        </>
      )}
      {result && (
        <Card>
          <Title>Hasil import</Title>
          <Body>
            {result.created.length} dibuat · {result.skipped.length} duplikat
            dilewati saat konfirmasi.
          </Body>
          {result.created.map((song) => (
            <Button
              key={song.id}
              title={`Lihat ${song.title}`}
              onPress={() => navigation.navigate("Song", { id: song.id })}
            />
          ))}
          {result.skipped.map((song, index) => (
            <Body key={`${song.id}-${index}`}>
              Dilewati: {song.title} · {song.source_filename}
            </Body>
          ))}
          <Body muted>
            Periksa lirik/attribution dan isi key/BPM yang belum tersedia. Mulai
            dengan 5–10 lagu sebelum batch besar.
          </Body>
        </Card>
      )}
    </Page>
  );
}
