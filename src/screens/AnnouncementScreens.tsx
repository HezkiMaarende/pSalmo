import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Routes } from "../navigation/types";
import { useChurch } from "../context/ChurchContext";
import * as api from "../lib/church";
import {
  announcementFilter,
  announcementSummary,
  isAnnouncementActive,
  normalizeAnnouncementInput,
  sortAnnouncements,
  type Announcement,
  type AnnouncementAction,
  type AnnouncementFilter,
  type AnnouncementInput,
} from "../domain/announcements";
import { dateLabel } from "../domain/calendar";
import { OfflineNotice } from "../components/OfflineNotice";
import {
  Body,
  Button,
  Card,
  Feedback,
  Field,
  Page,
  Title,
  openLink,
  useAction,
  useLoad,
  useUi,
} from "../components/ui";

type Props<K extends keyof Routes> = NativeStackScreenProps<Routes, K>;

function timestampLabel(value: string): string {
  return new Date(value).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(item: Announcement): string {
  if (item.archived_at) return "Arsip";
  if (!item.published_at) return "Draft";
  return isAnnouncementActive(item) ? "Terbit" : "Kedaluwarsa";
}

function FilterButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useUi();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 48,
        minWidth: 88,
        paddingHorizontal: 14,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: colors.teal,
        backgroundColor: selected ? colors.teal : colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: selected ? colors.onAccent : colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

function AnnouncementMeta({ item }: { item: Announcement }) {
  return (
    <>
      <Body muted>
        {statusLabel(item)}
        {item.pinned ? " · Disematkan" : ""}
      </Body>
      {item.published_at && (
        <Body muted>Diterbitkan {timestampLabel(item.published_at)}</Body>
      )}
      {item.updated_at !== item.created_at && (
        <Body muted>Diperbarui {timestampLabel(item.updated_at)}</Body>
      )}
      {item.expires_on && (
        <Body muted>Berlaku sampai {dateLabel(item.expires_on)}</Body>
      )}
    </>
  );
}

function AdminActions({
  item,
  busy,
  run,
}: {
  item: Announcement;
  busy: boolean;
  run: (action: () => Promise<unknown>) => void;
}) {
  const church = useChurch();
  const userId = church.session!.user.id;
  if (item.archived_at)
    return (
      <Button
        title="Pulihkan sebagai draft"
        disabled={busy}
        onPress={() =>
          run(() => api.transitionAnnouncement(item.id, "restore"))
        }
      />
    );
  const transition = (action: AnnouncementAction) =>
    run(() => api.transitionAnnouncement(item.id, action));
  return (
    <View style={{ gap: 8 }}>
      <Button
        title={item.pinned ? "Lepas sematan" : "Sematkan"}
        disabled={busy}
        onPress={() =>
          run(() => api.setAnnouncementPinned(item.id, userId, !item.pinned))
        }
      />
      <Button
        title={item.published_at ? "Tarik publikasi" : "Terbitkan sekarang"}
        disabled={busy}
        onPress={() => transition(item.published_at ? "unpublish" : "publish")}
      />
      <Button
        title="Arsipkan"
        disabled={busy}
        onPress={() =>
          Alert.alert(
            "Arsipkan pengumuman?",
            "Pengumuman akan disembunyikan dan dapat dipulihkan sebagai draft.",
            [
              { text: "Batal", style: "cancel" },
              {
                text: "Arsipkan",
                style: "destructive",
                onPress: () => transition("archive"),
              },
            ],
          )
        }
      />
    </View>
  );
}

export function AnnouncementsScreen({ navigation }: Props<"Announcements">) {
  const church = useChurch();
  const onlineAdmin =
    church.connection === "online" && church.membership?.role !== "member";
  const [filter, setFilter] = useState<AnnouncementFilter>("published");
  const state = useLoad(
    () => (onlineAdmin ? api.listAnnouncements() : church.loadAnnouncements()),
    [onlineAdmin, church.loadAnnouncements],
  );
  const action = useAction(state.reload);
  const items = useMemo(() => {
    const source = state.data || [];
    if (!onlineAdmin) return sortAnnouncements(source);
    const filtered = source.filter(
      (item) => announcementFilter(item) === filter,
    );
    return filter === "published"
      ? sortAnnouncements(filtered)
      : [...filtered].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [filter, onlineAdmin, state.data]);
  const run = (work: () => Promise<unknown>) => void action.run(work);
  return (
    <Page>
      <Title>Pengumuman</Title>
      <OfflineNotice />
      {onlineAdmin && (
        <>
          <Button
            title="Tambah pengumuman"
            onPress={() => navigation.navigate("AnnouncementEdit")}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <FilterButton
              label="Terbit"
              selected={filter === "published"}
              onPress={() => setFilter("published")}
            />
            <FilterButton
              label="Draft"
              selected={filter === "draft"}
              onPress={() => setFilter("draft")}
            />
            <FilterButton
              label="Arsip"
              selected={filter === "archived"}
              onPress={() => setFilter("archived")}
            />
          </View>
        </>
      )}
      <Feedback
        loading={state.loading || action.busy}
        error={state.error || action.error}
      />
      {!state.loading && !state.error && !items.length && (
        <Body muted>
          {onlineAdmin
            ? "Belum ada pengumuman pada bagian ini."
            : "Belum ada pengumuman."}
        </Body>
      )}
      {items.map((item) => (
        <Card key={item.id}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Buka pengumuman ${item.title}`}
            onPress={() => navigation.navigate("Announcement", { id: item.id })}
            style={{ minHeight: 48, gap: 8 }}
          >
            <Title>{item.title}</Title>
            <Body>{announcementSummary(item.body)}</Body>
            <AnnouncementMeta item={item} />
          </Pressable>
          {onlineAdmin && (
            <AdminActions item={item} busy={action.busy} run={run} />
          )}
        </Card>
      ))}
    </Page>
  );
}

export function AnnouncementScreen({
  route,
  navigation,
}: Props<"Announcement">) {
  const church = useChurch();
  const onlineAdmin =
    church.connection === "online" && church.membership?.role !== "member";
  const state = useLoad(
    () => church.loadAnnouncement(route.params.id),
    [route.params.id, church.loadAnnouncement],
  );
  const action = useAction(state.reload);
  const run = (work: () => Promise<unknown>) => void action.run(work);
  const item = state.data;
  return (
    <Page>
      <OfflineNotice />
      <Feedback
        loading={state.loading || action.busy}
        error={state.error || action.error}
      />
      {item && (
        <>
          <Title>{item.title}</Title>
          <AnnouncementMeta item={item} />
          <Card>
            <Body>{item.body}</Body>
          </Card>
          {item.external_url && (
            <Button
              title="Buka tautan"
              disabled={action.busy}
              onPress={() =>
                church.connection === "offline"
                  ? Alert.alert(
                      "Internet diperlukan",
                      "Tautan eksternal tidak dapat dibuka saat mode offline.",
                    )
                  : run(() => openLink(item.external_url!))
              }
            />
          )}
          {onlineAdmin && !item.archived_at && (
            <Button
              title="Edit pengumuman"
              onPress={() =>
                navigation.navigate("AnnouncementEdit", { id: item.id })
              }
            />
          )}
          {onlineAdmin && (
            <AdminActions item={item} busy={action.busy} run={run} />
          )}
        </>
      )}
    </Page>
  );
}

const EMPTY_INPUT: AnnouncementInput = {
  title: "",
  body: "",
  external_url: "",
  pinned: false,
  expires_on: "",
};

function inputFrom(item: Announcement): AnnouncementInput {
  return {
    title: item.title,
    body: item.body,
    external_url: item.external_url || "",
    pinned: item.pinned,
    expires_on: item.expires_on || "",
  };
}

export function AnnouncementEditScreen({
  route,
  navigation,
}: Props<"AnnouncementEdit">) {
  const church = useChurch();
  const id = route.params?.id;
  const authorized =
    church.connection === "online" && church.membership?.role !== "member";
  const state = useLoad(
    () => (id ? api.getAnnouncement(id) : Promise.resolve(null)),
    [id],
  );
  const initialized = useRef<string | null>(null);
  const [input, setInput] = useState<AnnouncementInput>(EMPTY_INPUT);
  const [baseline, setBaseline] = useState(JSON.stringify(EMPTY_INPUT));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const dirty = JSON.stringify(input) !== baseline;

  useEffect(() => {
    if (state.data && initialized.current !== state.data.id) {
      const next = inputFrom(state.data);
      initialized.current = state.data.id;
      setInput(next);
      setBaseline(JSON.stringify(next));
    }
  }, [state.data]);

  useEffect(() => {
    if (savedId) navigation.replace("Announcement", { id: savedId });
  }, [navigation, savedId]);

  usePreventRemove(dirty || saving, ({ data }) => {
    if (saving) return;
    Alert.alert("Perubahan belum disimpan", "Kembali tanpa menyimpan?", [
      { text: "Tetap di sini", style: "cancel" },
      {
        text: "Abaikan perubahan",
        style: "destructive",
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  async function save() {
    if (!authorized || saving) return;
    setSaving(true);
    setError("");
    try {
      const normalized = normalizeAnnouncementInput(input);
      const normalizedInput: AnnouncementInput = {
        ...normalized,
        external_url: normalized.external_url || "",
        expires_on: normalized.expires_on || "",
      };
      const result = await api.saveAnnouncement(
        id || null,
        church.session!.user.id,
        normalizedInput,
      );
      setInput(normalizedInput);
      setBaseline(JSON.stringify(normalizedInput));
      setSaving(false);
      setSavedId(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSaving(false);
    }
  }

  if (!authorized)
    return (
      <Page>
        <Title>Pengumuman</Title>
        <Body>Hanya PIC/admin online yang dapat mengubah pengumuman.</Body>
      </Page>
    );

  return (
    <Page>
      <Title>{id ? "Edit pengumuman" : "Pengumuman baru"}</Title>
      <Feedback loading={!!id && state.loading} error={state.error || error} />
      {(!id || state.data) && (
        <>
          <Field
            label="Judul pengumuman"
            value={input.title}
            disabled={saving}
            onChangeText={(title) => setInput({ ...input, title })}
          />
          <Field
            label="Isi pengumuman"
            value={input.body}
            multiline
            disabled={saving}
            onChangeText={(body) => setInput({ ...input, body })}
          />
          <Field
            label="URL tautan HTTPS (opsional)"
            value={input.external_url}
            disabled={saving}
            onChangeText={(external_url) =>
              setInput({ ...input, external_url })
            }
          />
          <Field
            label="Tanggal kedaluwarsa YYYY-MM-DD (opsional)"
            value={input.expires_on}
            disabled={saving}
            onChangeText={(expires_on) => setInput({ ...input, expires_on })}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: input.pinned }}
            disabled={saving}
            onPress={() => setInput({ ...input, pinned: !input.pinned })}
            style={{ minHeight: 48, justifyContent: "center" }}
          >
            <Body>{input.pinned ? "☑" : "☐"} Sematkan pengumuman</Body>
          </Pressable>
          <Body muted>
            Simpan membuat atau memperbarui draft. Gunakan Terbitkan sekarang
            setelah isi diperiksa.
          </Body>
          <Button
            title="Simpan pengumuman"
            disabled={saving}
            onPress={() => void save()}
          />
        </>
      )}
    </Page>
  );
}
