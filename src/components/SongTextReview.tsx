import React, { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import * as api from "../lib/church";
import {
  matchingSongs,
  normalizedTitle,
  previewSongText,
  reviewedEntries,
  SongCandidate,
} from "../domain/songReview";
import { Body, Button, Card, Feedback, Field, Title, useAction } from "./ui";

export function SongTextReview({
  serviceId,
  onStatusChange,
  onAdded,
  externalBusy = false,
}: {
  serviceId: string;
  onStatusChange: (dirty: boolean, busy: boolean) => void;
  onAdded: () => void;
  externalBusy?: boolean;
}) {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<{
    candidates: SongCandidate[];
    songs: api.Song[];
    revision: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  const action = useAction();
  const busy = action.busy || externalBusy;
  useEffect(() => {
    onStatusChange(!!raw.trim() || !!preview, action.busy);
  }, [raw, preview, action.busy, onStatusChange]);
  useEffect(() => () => onStatusChange(false, false), [onStatusChange]);
  function patch(id: string, value: Partial<SongCandidate>) {
    setPreview(
      (current) =>
        current && {
          ...current,
          candidates: current.candidates.map((candidate) =>
            candidate.id === id ? { ...candidate, ...value } : candidate,
          ),
        },
    );
  }
  return (
    <Card>
      <Title>Dari teks WhatsApp · tinjau dulu</Title>
      <Body muted>
        Pemrosesan lokal, bukan AI. Teks tidak dikirim ke provider atau
        disimpan. Gunakan satu judul per baris; header, nama petugas dan catatan
        harus dibuang sendiri. Key/BPM tidak ditebak.
      </Body>
      <Feedback error={action.error} />
      {!!message && <Body>{message}</Body>}
      {!preview ? (
        <>
          <Field
            label="Tempel daftar lagu (maks. 10.000 karakter)"
            value={raw}
            disabled={busy}
            onChangeText={setRaw}
            multiline
          />
          <Button
            title="Buat pratinjau · belum menambah lagu"
            disabled={busy || !raw.trim()}
            onPress={() =>
              void action.run(async () => {
                previewSongText(raw, []);
                const detail = await api.getServiceDetail(serviceId);
                if (!detail.can_edit)
                  throw new Error("Akses edit tidak tersedia.");
                const songs = await api.listSongs();
                setPreview({
                  candidates: previewSongText(raw, songs),
                  songs,
                  revision: detail.revision,
                });
                // Bounds are checked before making any network request; only authorized
                // service/library reads occur. Raw text never crosses the API boundary.
                setMessage("");
              })
            }
          />
        </>
      ) : (
        <>
          <Body muted>
            Pratinjau belum menyimpan apa pun. Judul yang sama boleh diulang;
            buang duplikat jika tidak disengaja. Urutan mengikuti pesan.
          </Body>
          {preview.candidates.map((candidate, index) => {
            const selectedSong = preview.songs.find(
              (song) => song.id === candidate.songId,
            );
            const matches = matchingSongs(candidate.title, preview.songs);
            const duplicate = preview.candidates.some(
              (other) =>
                other.id !== candidate.id &&
                other.selected &&
                normalizedTitle(other.title) ===
                  normalizedTitle(candidate.title),
            );
            return (
              <View key={candidate.id} style={{ gap: 8 }}>
                <Body>
                  {index + 1}. {candidate.selected ? "Dipilih" : "Dilewati"}
                  {duplicate ? " · judul berulang" : ""}
                </Body>
                <Field
                  label={`Judul kandidat ${index + 1}`}
                  value={candidate.title}
                  disabled={busy || !!selectedSong}
                  onChangeText={(title) =>
                    patch(candidate.id, { title, songId: null })
                  }
                />
                <Button
                  title={
                    candidate.selected
                      ? `Lewati kandidat ${index + 1}`
                      : `Pilih kandidat ${index + 1}`
                  }
                  disabled={busy}
                  onPress={() =>
                    patch(candidate.id, { selected: !candidate.selected })
                  }
                />
                {selectedSong ? (
                  <>
                    <Body>
                      Song Bank: {selectedSong.title}
                      {selectedSong.artist ? ` · ${selectedSong.artist}` : ""}.
                      Defaults, lirik dan referensi disalin saat konfirmasi.
                    </Body>
                    <Button
                      title={`Gunakan judul manual ${index + 1}`}
                      disabled={busy}
                      onPress={() => patch(candidate.id, { songId: null })}
                    />
                  </>
                ) : (
                  <>
                    <Body muted>
                      {matches.length > 1
                        ? "Beberapa judul cocok. Pilih lagu/artis atau tetap manual."
                        : "Judul manual: hanya ditambahkan ke ibadah, bukan Song Bank."}
                    </Body>
                    {matches.map((song) => (
                      <Button
                        key={song.id}
                        title={`Pakai ${song.title}${song.artist ? ` · ${song.artist}` : ""}`}
                        disabled={busy}
                        onPress={() => patch(candidate.id, { songId: song.id })}
                      />
                    ))}
                  </>
                )}
              </View>
            );
          })}
          <Button
            title="Kembali ke teks · buat ulang pratinjau"
            disabled={busy}
            onPress={() => setPreview(null)}
          />
          <Button
            title={`Konfirmasi tambah ${preview.candidates.filter((candidate) => candidate.selected).length} lagu`}
            disabled={
              busy ||
              !preview.candidates.some((candidate) => candidate.selected)
            }
            onPress={() =>
              Alert.alert(
                "Tambahkan lagu yang ditinjau?",
                "Seluruh pilihan ditambahkan dalam satu transaksi. Song Bank tidak diubah.",
                [
                  { text: "Batal", style: "cancel" },
                  {
                    text: "Tambahkan",
                    onPress: () =>
                      void action.run(async () => {
                        await api.addReviewedSongs(
                          serviceId,
                          preview.revision,
                          reviewedEntries(preview.candidates, preview.songs),
                        );
                        setRaw("");
                        setPreview(null);
                        setMessage(
                          "Lagu ditambahkan. Kembali untuk mengedit key/BPM/aransemen.",
                        );
                        onAdded();
                      }),
                  },
                ],
              )
            }
          />
        </>
      )}
      <Button
        title="Hapus teks dan pratinjau"
        disabled={busy || (!raw && !preview)}
        onPress={() =>
          Alert.alert("Hapus draft teks?", "Daftar lagu ibadah tidak diubah.", [
            { text: "Batal", style: "cancel" },
            {
              text: "Hapus draft",
              style: "destructive",
              onPress: () => {
                setRaw("");
                setPreview(null);
                setMessage("");
              },
            },
          ])
        }
      />
    </Card>
  );
}
