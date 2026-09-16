import React, { useEffect, useState } from "react";
import { useChurch } from "../context/ChurchContext";
import { saveProfileName, CHURCH_NAME } from "../lib/church";
import { supabase } from "../lib/supabase";
import {
  Page,
  Card,
  Title,
  Body,
  Field,
  Button,
  Feedback,
  useAction,
} from "../components/ui";
export function ProfileScreen() {
  const church = useChurch();
  const [name, setName] = useState(church.name);
  const [message, setMessage] = useState("");
  const a = useAction();
  useEffect(() => setName(church.name), [church.name]);
  return (
    <Page>
      <Title>Profil</Title>
      <Card>
        <Field label="Nama profil" value={name} onChangeText={setName} />
        <Body muted>
          Nama ini memperbarui sapaan, bukan nama pada daftar petugas.
        </Body>
        <Feedback error={a.error} />
        <Body>{message}</Body>
        <Button
          title="Simpan nama"
          disabled={a.busy}
          onPress={() =>
            void a.run(async () => {
              await saveProfileName(church.session!.user.id, name);
              await church.refresh();
              setMessage("Nama profil diperbarui.");
            })
          }
        />
      </Card>
      <Card>
        <Body>{church.session?.user.email}</Body>
        <Body muted>{CHURCH_NAME}</Body>
        <Body muted>
          Peran: {church.membership?.role}
          {church.membership?.song_editor ? " · editor lagu permanen" : ""}
        </Body>
        <Button
          title="Keluar akun"
          disabled={a.busy}
          onPress={() =>
            void a.run(async () => {
              const r = await supabase.auth.signOut();
              if (r.error) throw r.error;
            })
          }
        />
      </Card>
    </Page>
  );
}
export function AnnouncementsScreen() {
  return (
    <Page>
      <Title>Pengumuman</Title>
      <Body muted>Belum ada pengumuman.</Body>
    </Page>
  );
}
export function RulesScreen() {
  return (
    <Page>
      <Title>Peraturan</Title>
      <Body muted>Konten peraturan belum tersedia.</Body>
    </Page>
  );
}
