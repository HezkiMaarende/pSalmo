import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { defaultMeter, timeSignatureOptions } from "../domain/metronome";
import { Body, Button, useUi } from "./ui";
import { ThemeColors } from "../domain/theme";

export function TimeSignaturePicker({
  label = "Birama",
  value,
  onChange,
  disabled = false,
}: {
  label?: string;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
}) {
  const { colors, styles } = useUi();
  const s = createStyles(colors);
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const close = () => setOpen(false);
  value = defaultMeter(value);
  const legacy = !!value && !timeSignatureOptions.includes(value);
  return (
    <View style={{ gap: 6 }}>
      <Body muted>{label}</Body>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || "Belum dipilih"}`}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.field, s.trigger, disabled && { opacity: 0.45 }]}
      >
        <Text style={styles.text}>{value || "Pilih birama"}</Text>
        <Text style={s.arrow}>▾</Text>
      </Pressable>
      <Modal
        visible={open && !disabled}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={s.overlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            accessibilityRole="button"
            accessibilityLabel="Tutup pilihan birama"
            onPress={close}
          />
          <View
            style={[s.dialog, { maxHeight: Math.max(180, height - 80) }]}
            accessibilityViewIsModal
          >
            <Text style={styles.title} accessibilityRole="header">
              Pilih birama
            </Text>
            <Body muted>Pilih ketukan 1–12, dengan penyebut 2, 4, atau 8.</Body>
            {legacy && (
              <Body muted>
                Nilai tersimpan: {value}. Tetap dipakai sampai Anda memilih
                penggantinya.
              </Body>
            )}
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={s.options}
            >
              {timeSignatureOptions.map((signature) => (
                <Pressable
                  key={signature}
                  accessibilityRole="button"
                  accessibilityLabel={`Pilih ${signature}`}
                  accessibilityState={{ selected: signature === value }}
                  onPress={() => {
                    if (!disabled) onChange(signature);
                    close();
                  }}
                  style={[s.option, signature === value && s.selected]}
                >
                  <Text
                    style={[
                      s.optionText,
                      signature === value && { color: colors.onAccent },
                    ]}
                  >
                    {signature}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button title="Batal" onPress={close} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    trigger: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    arrow: { color: colors.teal, fontSize: 22 },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      padding: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    dialog: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: colors.background,
      borderRadius: 18,
      padding: 16,
      gap: 12,
    },
    options: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 8,
      paddingVertical: 4,
    },
    option: {
      width: "30%",
      minHeight: 48,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 10,
    },
    selected: { backgroundColor: colors.teal, borderColor: colors.teal },
    optionText: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  });
