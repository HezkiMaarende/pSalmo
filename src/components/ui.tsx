import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../domain/theme";
export function useUi() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return { colors, styles };
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 14, paddingBottom: 40 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      gap: 10,
      borderColor: colors.border,
      borderWidth: 1,
    },
    title: { fontSize: 23, fontWeight: "700", color: colors.ink },
    text: { fontSize: 16, lineHeight: 24, color: colors.ink },
    muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center",
    },
    field: {
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
      borderRadius: 9,
      padding: 12,
      minHeight: 48,
      fontSize: 16,
      color: colors.ink,
    },
    button: {
      minHeight: 48,
      borderRadius: 9,
      backgroundColor: colors.teal,
      paddingHorizontal: 14,
      paddingVertical: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    buttonText: { color: colors.onAccent, fontSize: 15, fontWeight: "600" },
    error: { color: colors.error, fontSize: 15, lineHeight: 22 },
    divider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 10,
      flexDirection: "row",
      gap: 16,
    },
    role: { width: 110, color: colors.muted, fontSize: 15 },
    person: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink },
  });
export function Page({ children }: { children: React.ReactNode }) {
  const { styles } = useUi();
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  const { styles } = useUi();
  return <View style={styles.card}>{children}</View>;
}
export function Title({ children }: { children: React.ReactNode }) {
  const { styles } = useUi();
  return <Text style={styles.title}>{children}</Text>;
}
export function Body({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  const { styles } = useUi();
  return <Text style={muted ? styles.muted : styles.text}>{children}</Text>;
}
export function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { styles } = useUi();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && { opacity: 0.45 }]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  secure = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  multiline?: boolean;
  secure?: boolean;
  disabled?: boolean;
}) {
  const { styles, colors } = useUi();
  const { mode } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Body muted>{label}</Body>
      <TextInput
        accessibilityLabel={label}
        style={[
          styles.field,
          multiline && { minHeight: 110, textAlignVertical: "top" },
        ]}
        value={value}
        editable={!disabled}
        placeholderTextColor={colors.muted}
        selectionColor={colors.teal}
        keyboardAppearance={mode}
        onChangeText={onChangeText}
        multiline={multiline}
        secureTextEntry={secure}
        autoCapitalize={secure || /email/i.test(label) ? "none" : "sentences"}
        autoCorrect={!secure && !/email/i.test(label)}
      />
    </View>
  );
}
export function useLoad<T>(
  loader: () => Promise<T>,
  deps: React.DependencyList = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const version = useRef(0);
  const focused = useRef(false);
  const reload = useCallback(async () => {
    const ticket = ++version.current;
    if (!focused.current) return;
    setLoading(true);
    setError("");
    try {
      const result = await loader();
      if (ticket === version.current && focused.current) setData(result);
    } catch (e) {
      if (ticket === version.current && focused.current) {
        setData(null);
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (ticket === version.current && focused.current) setLoading(false);
    }
  }, deps);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setData(null);
      void reload();
      return () => {
        focused.current = false;
        ++version.current;
        setData(null);
      };
    }, [reload]),
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active" && focused.current) {
        setData(null);
        void reload();
      }
    });
    return () => listener.remove();
  }, [reload]);
  return { data, error, loading, reload };
}
export function useAction(reload?: () => Promise<unknown>) {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<unknown>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      await reload?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}
export function Feedback({
  loading,
  error,
}: {
  loading?: boolean;
  error?: string;
}) {
  const { styles, colors } = useUi();
  return (
    <>
      {loading && (
        <ActivityIndicator color={colors.teal} accessibilityLabel="Memuat" />
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </>
  );
}
export async function openLink(url: string) {
  if (!/^https?:\/\//.test(url)) throw new Error("Tautan tidak valid.");
  await Linking.openURL(url);
}
