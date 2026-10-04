import React, { useMemo, useState } from "react";
import { Alert, Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import * as api from "../lib/church";
import { rangeSelection } from "../domain/medley";
import { songLabel } from "../domain/songLabel";
import {
  Body,
  Button,
  Field,
  Feedback,
  Page,
  Title,
  useAction,
  useUi,
} from "./ui";

export function MedleyEditor({
  detail,
  groupId,
  onClose,
  onSaved,
  onDirtyChange,
}: {
  detail: api.ServiceDetail;
  groupId: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { styles } = useUi();
  const { colors } = useTheme();
  const group = detail.medley_groups.find((entry) => entry.id === groupId);
  const members = detail.items.filter(
    (item) => item.medley_group_id === groupId && !!group,
  );
  const [first, setFirst] = useState(members[0]?.id || "");
  const [last, setLast] = useState(members[members.length - 1]?.id || "");
  const [label, setLabel] = useState(group?.label || "");
  const [error, setError] = useState("");
  const action = useAction();
  const dirty =
    first !== (members[0]?.id || "") ||
    last !== (members[members.length - 1]?.id || "") ||
    label !== (group?.label || "");
  const selection = useMemo(() => {
    try {
      return rangeSelection(detail.items, first, last, groupId || undefined);
    } catch {
      return [];
    }
  }, [detail.items, first, last, groupId]);
  const close = () => {
    if (action.busy) return;
    if (!dirty) {
      onDirtyChange(false);
      onClose();
      return;
    }
    Alert.alert("Perubahan medley belum disimpan", "Tutup tanpa menyimpan?", [
      { text: "Tetap di sini", style: "cancel" },
      {
        text: "Abaikan",
        style: "destructive",
        onPress: () => {
          onDirtyChange(false);
          onClose();
        },
      },
    ]);
  };
  const save = () => {
    setError("");
    try {
      rangeSelection(detail.items, first, last, groupId || undefined);
      if (label.trim().length > 80)
        throw new Error("Label maksimal 80 karakter.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    void action.run(async () => {
      try {
        await api.saveMedleyGroup(
          detail.service.id,
          detail.revision,
          groupId,
          first,
          last,
          label,
        );
      } finally {
        await onSaved();
      }
      onDirtyChange(false);
      onClose();
    });
  };
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Page>
          <Title>{group ? "Edit medley" : "Buat medley"}</Title>
          <Body muted>
            Pilih lagu awal dan akhir. Minimal dua lagu berurutan; medley lain
            tidak dapat dimasukkan.
          </Body>
          <Field
            label="Nama medley (opsional, maks. 80)"
            value={label}
            onChangeText={(value) => {
              setLabel(value);
              onDirtyChange(true);
            }}
          />
          <Body>Lagu awal</Body>
          <View style={styles.row}>
            {detail.items.map((item, index) => (
              <Button
                key={`first-${item.id}`}
                title={`${first === item.id ? "✓ " : ""}${index + 1}. ${songLabel(item.proposed_title, item.key)}`}
                onPress={() => {
                  setFirst(item.id);
                  onDirtyChange(true);
                }}
              />
            ))}
          </View>
          <Body>Lagu akhir</Body>
          <View style={styles.row}>
            {detail.items.map((item, index) => (
              <Button
                key={`last-${item.id}`}
                title={`${last === item.id ? "✓ " : ""}${index + 1}. ${songLabel(item.proposed_title, item.key)}`}
                onPress={() => {
                  setLast(item.id);
                  onDirtyChange(true);
                }}
              />
            ))}
          </View>
          <Body muted>
            {selection.length
              ? `${selection.length} lagu terpilih`
              : "Pilih rentang yang valid."}
          </Body>
          <Feedback error={error || action.error} />
          <Button
            title="Simpan medley"
            disabled={action.busy || selection.length < 2}
            onPress={save}
          />
          {group && (
            <Button
              title="Bubarkan medley"
              disabled={action.busy}
              onPress={() =>
                Alert.alert("Bubarkan medley?", "Lagu tetap ada di ibadah.", [
                  { text: "Batal", style: "cancel" },
                  {
                    text: "Bubarkan",
                    style: "destructive",
                    onPress: () =>
                      void action.run(async () => {
                        try {
                          await api.dissolveMedleyGroup(
                            detail.service.id,
                            detail.revision,
                            group.id,
                          );
                        } finally {
                          await onSaved();
                        }
                        onDirtyChange(false);
                        onClose();
                      }),
                  },
                ])
              }
            />
          )}
          <Button title="Tutup" disabled={action.busy} onPress={close} />
        </Page>
      </SafeAreaView>
    </Modal>
  );
}
