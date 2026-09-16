import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase, isConfigured } from "../lib/supabase";
import { CHURCH_NAME } from "../lib/church";
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
export function AuthScreen() {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const action = useAction();
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Page>
        <Title>pSalmo</Title>
        <Body>{CHURCH_NAME}</Body>
        <Card>
          <Title>{signup ? "Daftar akun" : "Masuk"}</Title>
          {signup && (
            <Field label="Nama profil" value={name} onChangeText={setName} />
          )}
          <Field label="Email" value={email} onChangeText={setEmail} />
          <Field
            label="Kata sandi"
            value={password}
            onChangeText={setPassword}
            secure
          />
          <Feedback error={action.error} />
          <Body>{message}</Body>
          <Button
            title={signup ? "Daftar" : "Masuk"}
            disabled={action.busy || !isConfigured}
            onPress={() =>
              void action.run(async () => {
                if (
                  !email.trim() ||
                  password.length < 6 ||
                  (signup && !name.trim())
                )
                  throw new Error(
                    "Isi email, kata sandi minimal 6 karakter, dan nama jika mendaftar.",
                  );
                const r = signup
                  ? await supabase.auth.signUp({
                      email: email.trim(),
                      password,
                      options: {
                        data: {
                          display_name: name.trim(),
                          full_name: name.trim(),
                        },
                      },
                    })
                  : await supabase.auth.signInWithPassword({
                      email: email.trim(),
                      password,
                    });
                if (r.error) throw r.error;
                if (signup)
                  setMessage(
                    "Periksa email jika konfirmasi diperlukan. Hubungi PIC untuk menautkan akun ke petugas.",
                  );
              })
            }
          />
          <Button
            title={signup ? "Sudah punya akun" : "Buat akun"}
            onPress={() => {
              setSignup(!signup);
              setMessage("");
            }}
          />
          {!isConfigured && <Body>Konfigurasi Supabase belum tersedia.</Body>}
        </Card>
      </Page>
    </SafeAreaView>
  );
}
