import React, { useState } from "react";
import { View, Alert } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Routes, RootRoutes } from "../navigation/types";
import { useChurch } from "../context/ChurchContext";
import * as api from "../lib/church";
import { dateLabel } from "../domain/calendar";
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
  openLink,
} from "../components/ui";
import { VideoReference } from "../components/VideoReference";
import { TimeSignaturePicker } from "../components/TimeSignaturePicker";
import { defaultMeter } from "../domain/metronome";
import { songLabel } from "../domain/songLabel";
import { Roster } from "./WeeklyScreens";
import { youtubeId } from "../domain/youtube";
type Props<K extends keyof Routes> = NativeStackScreenProps<Routes, K>;
export function ServiceScreen({ route, navigation }: Props<"Service">) {
  const { id } = route.params;
  const church = useChurch();
  const admin = church.membership?.role !== "member";
  const [rosterOpen, setRosterOpen] = useState(false);
  const state = useLoad(() => api.getServiceDetail(id), [id]);
  const action = useAction(state.reload);
  const d = state.data;
  return (
    <Page>
      <Feedback loading={state.loading} error={state.error || action.error} />
      {state.error && (
        <Button title="Coba muat ulang" onPress={() => void state.reload()} />
      )}
      {d && (
        <>
          <Title>{d.service.title}</Title>
          <Body>
            {dateLabel(d.service.service_day)} · {d.service.status}
          </Body>
          {d.service.service_type === "ir_1_2" && (
            <Body muted>IR 1 & 2 berbagi seluruh petugas dan daftar lagu.</Body>
          )}
          <Card>
            <Title>Petugas</Title>
            <Button
              title={rosterOpen ? "Tutup petugas" : "Lihat semua"}
              onPress={() => setRosterOpen(!rosterOpen)}
            />
            {rosterOpen && <Roster rows={d.assignments} />}
            {admin && <RosterEditor detail={d} reload={state.reload} />}
          </Card>
          {admin && (
            <Card>
              <Title>Persetujuan daftar lagu</Title>
              <View style={styles.row}>
                {(["draft", "approved", "archived", "cancelled"] as const).map(
                  (status) => (
                    <Button
                      key={status}
                      title={status}
                      disabled={action.busy || status === d.service.status}
                      onPress={() =>
                        void action.run(() =>
                          api.updateServiceStatus(id, status),
                        )
                      }
                    />
                  ),
                )}
              </View>
              <Body muted>
                Persetujuan ini tidak mengumumkan jadwal petugas. Kelola
                pengumuman melalui Jadwal.
              </Body>
            </Card>
          )}
          <Title>Daftar lagu</Title>
          {d.can_edit && (
            <Button
              title="Tambah lagu · manual / Song Bank"
              onPress={() => navigation.navigate("AddSongs", { serviceId: id })}
            />
          )}
          {!d.items.length && <Body muted>Belum ada lagu.</Body>}
          {d.items.map((item, index) => (
            <SongRow
              key={item.id}
              item={item}
              index={index}
              count={d.items.length}
              editable={d.can_edit}
              revision={d.revision}
              reload={state.reload}
              edit={() =>
                navigation.navigate("Arrangement", {
                  serviceId: id,
                  itemId: item.id,
                })
              }
            />
          ))}
          <Card>
            <Title>Latihan & metronom</Title>
            <Body muted>
              Atur BPM, birama, struktur, chord, dan catatan melalui Edit
              aransemen atau halaman Latihan. Audio klik memerlukan development
              build native; belum tervalidasi untuk pelayanan langsung.
            </Body>
            <Button
              title="Mulai latihan · Setlist / Practice"
              disabled={!d.items.length}
              onPress={() => navigation.navigate("Practice", { serviceId: id })}
            />
          </Card>
          <Card>
            <Title>Catatan ibadah</Title>
            {d.notes.map((n) => (
              <View key={n.id}>
                <Body>{n.body}</Body>
                {admin && (
                  <Button
                    title="Hapus catatan"
                    disabled={action.busy}
                    onPress={() =>
                      void action.run(() =>
                        api.deleteRow("service_notes", n.id),
                      )
                    }
                  />
                )}
              </View>
            ))}
            {admin && <NoteEditor serviceId={id} reload={state.reload} />}
          </Card>
          <Card>
            <Title>Referensi ibadah</Title>
            {d.media.map((m) => (
              <View key={m.id} style={{ gap: 8 }}>
                <Button
                  title={m.label}
                  onPress={() => void action.run(() => openLink(m.url))}
                />
                {admin && (
                  <Button
                    title="Hapus referensi"
                    onPress={() =>
                      void action.run(() =>
                        api.deleteRow("media_references", m.id),
                      )
                    }
                  />
                )}
              </View>
            ))}
            {admin && <MediaEditor serviceId={id} reload={state.reload} />}
          </Card>
        </>
      )}
    </Page>
  );
}
function RosterEditor({
  detail,
  reload,
}: {
  detail: api.ServiceDetail;
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState("WL");
  const [guest, setGuest] = useState("");
  const [person, setPerson] = useState<api.Person | null>(null);
  const [people, setPeople] = useState<api.Person[]>([]);
  const action = useAction(reload);
  return (
    <View style={{ gap: 10 }}>
      <Button
        title={editing ? "Tutup editor petugas" : "Edit petugas"}
        onPress={() =>
          void action.run(async () => {
            setPeople((await api.listPeople()).filter((p) => p.active));
            setEditing(!editing);
          })
        }
      />
      <Feedback error={action.error} />
      {editing && (
        <>
          <Field
            label="Peran (WL, MD, Singer, Piano, Drum, …)"
            value={role}
            onChangeText={setRole}
          />
          <Body muted>
            Pilih nama. Tambahkan berulang untuk beberapa orang dalam satu
            peran.
          </Body>
          <View style={styles.row}>
            {people.map((p) => (
              <Button
                key={p.id}
                title={`${person?.id === p.id ? "✓ " : ""}${p.name}`}
                onPress={() => {
                  setPerson(p);
                  setGuest("");
                }}
              />
            ))}
            <Button
              title="Nama tamu / kelompok"
              onPress={() => setPerson(null)}
            />
          </View>
          {!person && (
            <Field
              label="Label tamu (tidak memberikan akses)"
              value={guest}
              onChangeText={setGuest}
            />
          )}
          <Button
            title="Tambahkan petugas"
            disabled={action.busy}
            onPress={() =>
              void action.run(() =>
                api.addAssignment(detail.service.id, role, person, guest),
              )
            }
          />
          {detail.assignments.map((a) => (
            <Button
              key={a.id}
              title={`Hapus ${a.role_name}: ${a.display_name}`}
              disabled={action.busy}
              onPress={() =>
                void action.run(() =>
                  api.deleteRow("service_assignments", a.id),
                )
              }
            />
          ))}
        </>
      )}
    </View>
  );
}
function SongRow({
  item,
  index,
  count,
  editable,
  revision,
  reload,
  edit,
}: {
  item: api.SetlistItem;
  index: number;
  count: number;
  editable: boolean;
  revision: number;
  reload: () => Promise<void>;
  edit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const action = useAction();
  return (
    <Card>
      <Title>
        {index + 1}. {songLabel(item.proposed_title, item.key)}
      </Title>
      <Body muted>
        {[
          item.artist,
          item.key && `Key ${item.key}`,
          item.bpm && `${item.bpm} BPM`,
          item.time_signature,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Body>
      <Button
        title={expanded ? "Tutup lirik" : "Lihat lirik / chord"}
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
        <Body>{item.lyrics_or_chords || "Lirik belum tersedia."}</Body>
      )}
      {!!item.structure?.length && (
        <Body muted>
          {item.structure
            .map((s) => `${s.section}${s.bars ? ` (${s.bars} bar)` : ""}`)
            .join(" → ")}
        </Body>
      )}
      {!!item.notes && <Body>{item.notes}</Body>}
      {item.arrangement_url &&
        (youtubeId(item.arrangement_url) ? (
          <VideoReference
            label={
              item.library_references?.find(
                (r) => r.url === item.arrangement_url,
              )?.label || "Aransemen"
            }
            url={item.arrangement_url}
          />
        ) : (
          <Button
            title="Buka aransemen"
            onPress={() =>
              void action.run(() => openLink(item.arrangement_url!))
            }
          />
        ))}
      {item.library_references
        ?.filter((r) => r.url !== item.arrangement_url)
        .map((r, i) => (
          <VideoReference key={`${r.url}-${i}`} label={r.label} url={r.url} />
        ))}
      <Feedback error={action.error} />
      {editable && (
        <View style={styles.row}>
          <Button title="Edit aransemen" onPress={edit} />
          <Button
            title="↑ Lagu"
            disabled={action.busy || index === 0}
            onPress={() =>
              void action.run(async () => {
                try {
                  await api.moveSetlistItem(item.id, "up", revision);
                } finally {
                  await reload();
                }
              })
            }
          />
          <Button
            title="↓ Lagu"
            disabled={action.busy || index === count - 1}
            onPress={() =>
              void action.run(async () => {
                try {
                  await api.moveSetlistItem(item.id, "down", revision);
                } finally {
                  await reload();
                }
              })
            }
          />
          <Button
            title="Hapus lagu"
            disabled={action.busy}
            onPress={() =>
              Alert.alert("Hapus dari ibadah?", "Song Bank tidak dihapus.", [
                { text: "Batal", style: "cancel" },
                {
                  text: "Hapus",
                  style: "destructive",
                  onPress: () =>
                    void action.run(async () => {
                      await api.deleteRow("setlist_items", item.id);
                      await reload();
                    }),
                },
              ])
            }
          />
        </View>
      )}
    </Card>
  );
}
function NoteEditor({
  serviceId,
  reload,
}: {
  serviceId: string;
  reload: () => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const church = useChurch();
  const a = useAction(reload);
  return (
    <>
      <Field
        label="Catatan bersama"
        value={body}
        onChangeText={setBody}
        multiline
      />
      <Feedback error={a.error} />
      <Button
        title="Simpan catatan"
        disabled={a.busy}
        onPress={() =>
          void a.run(async () => {
            await api.addNote(serviceId, church.session!.user.id, body);
            setBody("");
          })
        }
      />
    </>
  );
}
function MediaEditor({
  serviceId,
  reload,
}: {
  serviceId: string;
  reload: () => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const a = useAction(reload);
  return (
    <>
      <Field label="Label referensi" value={label} onChangeText={setLabel} />
      <Field label="URL referensi" value={url} onChangeText={setUrl} />
      <Feedback error={a.error} />
      <Button
        title="Tambah referensi"
        disabled={a.busy}
        onPress={() => void a.run(() => api.addMedia(serviceId, label, url))}
      />
    </>
  );
}
export function ArrangementScreen({ route, navigation }: Props<"Arrangement">) {
  const { serviceId, itemId } = route.params;
  const s = useLoad(() => api.getServiceDetail(serviceId), [serviceId, itemId]);
  const item = s.data?.items.find((i) => i.id === itemId);
  return (
    <Page>
      <Title>Edit aransemen</Title>
      <Feedback loading={s.loading} error={s.error} />
      {s.data &&
        (!s.data.can_edit ? (
          <Body>Akses edit tidak tersedia.</Body>
        ) : item ? (
          <ArrangementForm
            key={item.id}
            item={item}
            done={() => navigation.goBack()}
          />
        ) : (
          <Body>Lagu sudah dihapus.</Body>
        ))}
    </Page>
  );
}
function ArrangementForm({
  item,
  done,
}: {
  item: api.SetlistItem;
  done: () => void;
}) {
  const [input, setInput] = useState<api.ArrangementInput>({
    key: item.key || "",
    bpm: item.bpm?.toString() || "",
    signature: defaultMeter(item.time_signature),
    structure:
      item.structure
        ?.map((s) => `${s.section}${s.bars ? ` | ${s.bars}` : ""}`)
        .join("\n") || "",
    lyrics: item.lyrics_or_chords || "",
    url: item.arrangement_url || "",
    notes: item.notes || "",
  });
  const a = useAction();
  const labels: Record<keyof api.ArrangementInput, string> = {
    key: "Key ibadah",
    bpm: "BPM (20–400)",
    signature: "Birama",
    structure: "Struktur · Bagian | jumlah bar · satu per baris",
    lyrics: "Lirik / chord khusus ibadah",
    url: "URL aransemen",
    notes: "Catatan lagu",
  };
  return (
    <Card>
      <Body>{songLabel(item.proposed_title, item.key)}</Body>
      {(Object.keys(labels) as (keyof api.ArrangementInput)[]).map((k) =>
        k === "signature" ? (
          <TimeSignaturePicker
            key={k}
            label={labels[k]}
            value={input[k]}
            onChange={(v) => setInput({ ...input, [k]: v })}
            disabled={a.busy}
          />
        ) : (
          <Field
            key={k}
            label={labels[k]}
            value={input[k]}
            onChangeText={(v) => setInput({ ...input, [k]: v })}
            multiline={["lyrics", "structure", "notes"].includes(k)}
          />
        ),
      )}
      <Feedback error={a.error} />
      <Button
        title="Simpan aransemen"
        disabled={a.busy}
        onPress={() =>
          void a.run(async () => {
            await api.saveArrangement(item.id, input);
            done();
          })
        }
      />
    </Card>
  );
}
export function AddSongsScreen({ route }: Props<"AddSongs">) {
  return <AddSongsContent serviceId={route.params.serviceId} />;
}
export function MetronomeAddSongsScreen({ route }: NativeStackScreenProps<RootRoutes, "MetronomeAddSongs">) {
  return <AddSongsContent serviceId={route.params.serviceId} />;
}
function AddSongsContent({ serviceId }: { serviceId: string }) {
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");
  const state = useLoad(
    async () => ({
      detail: await api.getServiceDetail(serviceId),
      songs: await api.listSongs(),
    }),
    [serviceId],
  );
  const a = useAction();
  const [message, setMessage] = useState("");
  return (
    <Page>
      <Title>Tambah lagu</Title>
      <Feedback loading={state.loading} error={state.error || a.error} />
      <Body>{message}</Body>
      {state.data?.detail.can_edit && (
        <>
          <Card>
            <Field
              label="Judul manual · satu per baris"
              value={raw}
              onChangeText={setRaw}
              multiline
            />
            <Body muted>
              Ekstraksi pesan WhatsApp otomatis menunggu fase Smart Add. Gunakan
              judul manual sekarang.
            </Body>
            <Button
              title="Tambah judul manual"
              disabled={a.busy}
              onPress={() =>
                void a.run(async () => {
                  await api.addProposals(serviceId, raw);
                  setRaw("");
                  setMessage(
                    "Judul ditambahkan. Kembali untuk mengedit aransemen.",
                  );
                })
              }
            />
          </Card>
          <Field
            label="Cari judul / artis di Song Bank"
            value={query}
            onChangeText={setQuery}
          />
          {state.data.songs
            .filter((s) =>
              `${s.title} ${s.artist || ""}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((s) => (
              <Card key={s.id}>
                <Title>{s.title}</Title>
                <Body muted>{s.artist}</Body>
                <Button
                  title="Tambahkan ke ibadah"
                  disabled={a.busy}
                  onPress={() =>
                    void a.run(async () => {
                      await api.addSongToSetlist(serviceId, s.id);
                      setMessage(
                        `${s.title} ditambahkan sebagai salinan aransemen.`,
                      );
                    })
                  }
                />
              </Card>
            ))}
        </>
      )}
      {state.data && !state.data.detail.can_edit && (
        <Body>Akses edit tidak tersedia.</Body>
      )}
    </Page>
  );
}
