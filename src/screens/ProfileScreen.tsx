import React, { useEffect, useState } from "react";
import { useChurch } from "../context/ChurchContext";
import { saveProfileName, CHURCH_NAME } from "../lib/church";
import { supabase } from "../lib/supabase";
import { useTheme } from "../context/ThemeContext";
import { Pressable, Text, View } from "react-native";
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
  const theme = useTheme();
  const church = useChurch();
  const [name, setName] = useState(church.name);
  const [message, setMessage] = useState("");
  const a = useAction();
  useEffect(() => setName(church.name), [church.name]);
  return (
    <Page>
      <Title>Profil</Title>
      <Card>
        <Title>Tampilan</Title>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {(["light", "dark"] as const).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={mode === "light" ? "Tema Light" : "Tema Dark"}
              accessibilityState={{ selected: mode === theme.mode }}
              onPress={() => theme.setMode(mode)}
              style={{
                minWidth: 100,
                minHeight: 48,
                padding: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: theme.colors.teal,
                backgroundColor:
                  theme.mode === mode
                    ? theme.colors.teal
                    : theme.colors.surface,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  color:
                    theme.mode === mode
                      ? theme.colors.onAccent
                      : theme.colors.ink,
                }}
              >
                {mode === "light" ? "Light" : "Dark"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Body muted>
          Disimpan di perangkat ini, tetap berlaku setelah keluar akun.
        </Body>
        <Feedback error={theme.storageError} />
      </Card>
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
