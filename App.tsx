import React from "react";
import { View } from "react-native";
import {
  ClickPlayerProvider,
  ClickPlayerBar,
} from "./src/context/ClickPlayerContext";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ChurchProvider, useChurch } from "./src/context/ChurchContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { AuthScreen } from "./src/screens/AuthScreen";
import {
  Page,
  Title,
  Body,
  Button,
  Feedback,
  useAction,
} from "./src/components/ui";
import { supabase } from "./src/lib/supabase";
import { NavigationChromeProvider } from "./src/context/NavigationChromeContext";
function Root() {
  const church = useChurch();
  const action = useAction();
  if (church.loading)
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Page>
          <Feedback loading />
        </Page>
      </SafeAreaView>
    );
  if (!church.session) return <AuthScreen />;
  if (!church.membership)
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Page>
          <Title>Hello, {church.name || "teman"}</Title>
          <Body>
            Akun Anda belum ditautkan ke petugas gereja. Hubungi PIC dengan
            email {church.session.user.email}.
          </Body>
          <Feedback error={church.error || action.error} />
          <Button
            title="Periksa keanggotaan lagi"
            onPress={() => void action.run(church.refresh)}
          />
          <Button
            title="Keluar akun"
            onPress={() =>
              void action.run(async () => {
                const r = await supabase.auth.signOut();
                if (r.error) throw r.error;
              })
            }
          />
        </Page>
      </SafeAreaView>
    );
  return <AppNavigator />;
}
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ChurchProvider>
        <ClickPlayerProvider>
          <NavigationChromeProvider>
          <View style={{ flex: 1 }}>
            <Root />
            <ClickPlayerBar />
          </View>
          </NavigationChromeProvider>
        </ClickPlayerProvider>
      </ChurchProvider>
    </SafeAreaProvider>
  );
}
