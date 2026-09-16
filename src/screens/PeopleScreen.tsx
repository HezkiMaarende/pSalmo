import React, { useState } from "react";
import { Alert } from "react-native";
import { useChurch } from "../context/ChurchContext";
import * as api from "../lib/church";
import {
  Page,
  Card,
  Title,
  Body,
  Button,
  Field,
  Feedback,
  useLoad,
  useAction,
} from "../components/ui";
export function PeopleScreen() {
  const church = useChurch();
  const [name, setName] = useState("");
  const admin = church.membership?.role !== "member";
  const state = useLoad(
    async () => ({
      people: await api.listPeople(),
      members: await api.listMembers(),
    }),
    [],
  );
  const action = useAction(state.reload);
  return (
    <Page>
      <Title>Kelola Petugas</Title>
      {!admin ? (
        <Body>Hanya PIC/admin.</Body>
      ) : (
        <>
          <Body muted>
            Nama petugas terpisah dari nama profil. Tautkan email akun terdaftar
            untuk memberikan keanggotaan; tidak perlu undangan.
          </Body>
          <Field
            label="Nama petugas / keluarga / kelompok"
            value={name}
            onChangeText={setName}
          />
          <Button
            title="Tambah nama"
            disabled={action.busy}
            onPress={() =>
              void action.run(async () => {
                await api.addPerson(name);
                setName("");
              })
            }
          />
          <Feedback
            loading={state.loading}
            error={state.error || action.error}
          />
          {state.data?.people.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              member={state.data?.members.find(
                (m) => m.user_id === person.account_id,
              )}
              reload={state.reload}
            />
          ))}
        </>
      )}
    </Page>
  );
}
function PersonCard({
  person,
  member,
  reload,
}: {
  person: api.Person;
  member?: api.Member;
  reload: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const church = useChurch();
  const action = useAction(reload);
  const protectedMember =
    member?.role === "owner" ||
    (church.membership?.role === "admin" && member?.role === "admin");
  return (
    <Card>
      <Title>{person.name}</Title>
      <Body muted>
        {person.active ? "Aktif" : "Nonaktif · riwayat tetap tersimpan"}
        {member ? ` · ${member.role}` : ""}
      </Body>
      <Feedback error={action.error} />
      {!person.account_id ? (
        <>
          <Field
            label="Email persis akun yang sudah terdaftar"
            value={email}
            onChangeText={setEmail}
          />
          <Button
            title="Tautkan akun & aktifkan"
            disabled={action.busy}
            onPress={() =>
              void action.run(() => api.linkAccount(person.id, email))
            }
          />
        </>
      ) : (
        <>
          <Body muted>Akun tertaut: {person.account_id}</Body>
          <Button
            title={
              member?.song_editor
                ? "Cabut izin editor lagu"
                : "Izinkan editor lagu permanen"
            }
            disabled={action.busy}
            onPress={() =>
              void action.run(() =>
                api.setSongEditor(person.account_id!, !member?.song_editor),
              )
            }
          />
          {!protectedMember && (
            <Button
              title={
                member?.role === "admin"
                  ? "Ubah menjadi anggota"
                  : "Jadikan PIC/admin"
              }
              disabled={action.busy}
              onPress={() =>
                void action.run(() =>
                  api.setMemberRole(
                    person.account_id!,
                    member?.role === "admin" ? "member" : "admin",
                  ),
                )
              }
            />
          )}
        </>
      )}
      {person.active && !protectedMember && (
        <Button
          title="Keluarkan petugas"
          disabled={action.busy}
          onPress={() =>
            Alert.alert(
              "Keluarkan petugas?",
              "Akses gereja dan ibadah langsung dicabut. Nama pada jadwal lama tetap tersimpan.",
              [
                { text: "Batal", style: "cancel" },
                {
                  text: "Keluarkan",
                  style: "destructive",
                  onPress: () =>
                    void action.run(() => api.kickPerson(person.id)),
                },
              ],
            )
          }
        />
      )}
    </Card>
  );
}
