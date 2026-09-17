import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, Appearance, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import {
  palettes,
  ThemeColors,
  ThemeMode,
  ThemePreference,
} from "../domain/theme";

const Context = createContext<{
  mode: ThemeMode;
  colors: ThemeColors;
  setMode(mode: ThemeMode): void;
  storageError: string;
}>(null!);
export const useTheme = () => useContext(Context);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useRef<ThemePreference | null>(null);
  if (!preference.current)
    preference.current = new ThemePreference(AsyncStorage);
  const [mode, changeMode] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const ticket = useRef(0);
  useEffect(() => {
    let alive = true;
    void preference
      .current!.read()
      .then((value) => {
        if (alive) {
          Appearance.setColorScheme(value);
          changeMode(value);
        }
      })
      .catch(() => {
        if (alive) {
          Appearance.setColorScheme("light");
          setStorageError(
            "Preferensi tampilan tidak dapat dibaca. Menggunakan Light.",
          );
        }
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  const setMode = useCallback((value: ThemeMode) => {
    const current = ++ticket.current;
    Appearance.setColorScheme(value);
    changeMode(value); // Never await storage or remount navigation/audio/drafts.
    setStorageError("");
    void preference.current!.save(value).catch(() => {
      if (ticket.current === current)
        setStorageError(
          "Tema sesi berubah, tetapi preferensi gagal disimpan. Pilih ulang untuk mencoba lagi.",
        );
    });
  }, []);
  const colors = palettes[mode];
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palettes.light.background,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator
          color={palettes.light.teal}
          accessibilityLabel="Memuat tampilan"
        />
      </View>
    );
  return (
    <Context.Provider value={{ mode, colors, setMode, storageError }}>
      {children}
    </Context.Provider>
  );
}
