import { supabase } from "./supabase";
import type {
  MembershipRole,
  ServiceStatus,
  ServiceType,
  SongStructureSection,
} from "../domain/service";
import { youtubeId } from "../domain/youtube";
import { defaultMeter } from "../domain/metronome";
import { requiredSongTitle } from "../domain/songLabel";
import type { ReviewedSongEntry } from "../domain/songReview";
export const CHURCH_NAME = "GPdI Elshaddai Magelang";
export const churchId = process.env.EXPO_PUBLIC_CHURCH_TEAM_ID || "";
export interface Membership {
  role: MembershipRole;
  song_editor: boolean;
}
export interface Person {
  id: string;
  name: string;
  account_id: string | null;
  active: boolean;
}
export interface Member {
  user_id: string;
  role: MembershipRole;
  song_editor: boolean;
}
export interface Reference {
  id?: string;
  label: string;
  url: string;
  position?: number;
}
export interface Song {
  id: string;
  title: string;
  artist: string | null;
  default_key: string | null;
  default_bpm: number | null;
  default_time_signature: string | null;
  lyrics: string;
  writer_credits: string | null;
  copyright_notice: string | null;
  song_references: Reference[];
}
export interface Service {
  id: string;
  team_id: string;
  title: string;
  service_type: ServiceType;
  service_date: string;
  service_day: string;
  status: ServiceStatus;
}
export interface RosterRow {
  id: string;
  role_name: string;
  display_name: string | null;
}
export interface ScheduleService {
  id: string;
  title: string;
  service_type: ServiceType;
  status: ServiceStatus;
  assigned: boolean;
  can_open: boolean;
  can_edit: boolean;
  roster: RosterRow[];
}
export interface ScheduleWeek {
  sunday: string;
  published_at: string | null;
  services: ScheduleService[];
}
export interface SetlistItem {
  id: string;
  position: number;
  song_id: string | null;
  proposed_title: string | null;
  artist: string | null;
  key: string | null;
  bpm: number | null;
  time_signature: string | null;
  structure: SongStructureSection[];
  lyrics_or_chords: string | null;
  arrangement_url: string | null;
  library_references: Reference[];
  notes: string | null;
}
export interface ServiceDetail {
  service: Service;
  revision: number;
  items: SetlistItem[];
  can_edit: boolean;
  assignments: (RosterRow & {
    person_id: string | null;
    user_id: string | null;
  })[];
  notes: { id: string; body: string }[];
  media: { id: string; label: string; url: string }[];
}
function unwrap<T>({
  data,
  error,
}: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("Data tidak tersedia.");
  return data as NonNullable<T>;
}
async function rpc(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await supabase.rpc(name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function getMembership(
  userId: string,
): Promise<Membership | null> {
  if (!churchId) throw new Error("Konfigurasi gereja belum tersedia.");
  const r = await supabase
    .from("team_memberships")
    .select("role,song_editor")
    .eq("team_id", churchId)
    .eq("user_id", userId)
    .maybeSingle();
  if (r.error) throw new Error(r.error.message);
  return r.data as Membership | null;
}
export async function getProfileName(userId: string): Promise<string> {
  return unwrap(
    await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single(),
  ).display_name;
}
export async function saveProfileName(
  userId: string,
  name: string,
): Promise<void> {
  if (!name.trim()) throw new Error("Nama wajib diisi.");
  const r = await supabase
    .from("profiles")
    .update({ display_name: name.trim() })
    .eq("id", userId);
  if (r.error) throw new Error(r.error.message);
}
export async function readSchedule(
  from: string,
  to: string,
): Promise<ScheduleWeek[]> {
  return (await rpc("read_weekly_schedule", {
    target_team_id: churchId,
    date_from: from,
    date_to: to,
  })) as ScheduleWeek[];
}
export async function ensureWeek(day: string): Promise<void> {
  const r = await supabase
    .from("weekly_schedules")
    .upsert(
      { team_id: churchId, sunday: day },
      { onConflict: "team_id,sunday", ignoreDuplicates: true },
    );
  if (r.error) throw new Error(r.error.message);
}
export async function publishWeek(
  day: string,
  published: boolean,
): Promise<void> {
  const r = await supabase.from("weekly_schedules").upsert({
    team_id: churchId,
    sunday: day,
    published_at: published ? new Date().toISOString() : null,
  });
  if (r.error) throw new Error(r.error.message);
}
export async function createService(
  day: string,
  type: ServiceType,
  userId: string,
): Promise<Service> {
  await ensureWeek(day);
  return unwrap(
    await supabase
      .from("services")
      .insert({
        team_id: churchId,
        title: type === "ir_1_2" ? "Ibadah Raya 1 & 2" : "Ibadah Raya 3",
        service_type: type,
        service_date: `${day}T00:00:00+07:00`,
        created_by: userId,
      })
      .select("*")
      .single(),
  ) as Service;
}
export async function getServiceDetail(id: string): Promise<ServiceDetail> {
  const service = unwrap(
    await supabase
      .from("services")
      .select("*")
      .eq("id", id)
      .eq("team_id", churchId)
      .single(),
  ) as Service;
  const [a, n, m, l] = await Promise.all([
    supabase
      .from("service_assignments")
      .select("id,person_id,user_id,role_name,display_name")
      .eq("service_id", id)
      .order("position"),
    supabase.from("service_notes").select("id,body").eq("service_id", id),
    supabase
      .from("media_references")
      .select("id,label,url")
      .eq("service_id", id)
      .order("position"),
    supabase
      .from("setlists")
      .select("id,revision")
      .eq("service_id", id)
      .maybeSingle(),
  ]);
  if (l.error) throw new Error(l.error.message);
  const items = l.data
    ? (unwrap(
        await supabase
          .from("setlist_items")
          .select("*")
          .eq("setlist_id", l.data.id)
          .order("position"),
      ) as SetlistItem[])
    : [];
  const editable = await rpc("service_edit_permission", {
    target_service_id: id,
  });
  return {
    service,
    items,
    revision: l.data?.revision || 1,
    assignments: unwrap(a),
    notes: unwrap(n),
    media: unwrap(m),
    can_edit: editable === true,
  };
}
export async function visibleServices(
  from: string,
  to: string,
): Promise<Service[]> {
  return unwrap(
    await supabase
      .from("services")
      .select("*")
      .eq("team_id", churchId)
      .gte("service_day", from)
      .lte("service_day", to)
      .order("service_day"),
  ) as Service[];
}
export async function updateServiceStatus(
  id: string,
  status: ServiceStatus,
): Promise<void> {
  const r = await supabase.from("services").update({ status }).eq("id", id);
  if (r.error) throw new Error(r.error.message);
}
export async function listPeople(): Promise<Person[]> {
  return unwrap(
    await supabase
      .from("roster_people")
      .select("id,name,account_id,active")
      .eq("team_id", churchId)
      .order("name"),
  ) as Person[];
}
export async function listMembers(): Promise<Member[]> {
  return unwrap(
    await supabase
      .from("team_memberships")
      .select("user_id,role,song_editor")
      .eq("team_id", churchId),
  ) as Member[];
}
export async function addPerson(name: string): Promise<void> {
  if (!name.trim()) throw new Error("Nama wajib diisi.");
  const r = await supabase
    .from("roster_people")
    .insert({ team_id: churchId, name: name.trim() });
  if (r.error) throw new Error(r.error.message);
}
export async function linkAccount(id: string, email: string): Promise<void> {
  if (!email.trim()) throw new Error("Email akun wajib diisi.");
  await rpc("link_roster_account", {
    target_person_id: id,
    registered_email: email.trim(),
  });
}
export async function kickPerson(id: string): Promise<void> {
  await rpc("kick_roster_person", { target_person_id: id });
}
export async function setSongEditor(
  userId: string,
  enabled: boolean,
): Promise<void> {
  await rpc("set_song_editor", {
    target_team_id: churchId,
    target_user_id: userId,
    enabled,
  });
}
export async function setMemberRole(
  userId: string,
  role: "member" | "admin",
): Promise<void> {
  await rpc("set_team_member_role", {
    target_team_id: churchId,
    target_user_id: userId,
    new_role: role,
  });
}
export async function addAssignment(
  serviceId: string,
  role: string,
  person: Person | null,
  guest: string,
): Promise<void> {
  if (!role.trim() || (!person && !guest.trim()))
    throw new Error("Pilih peran dan petugas atau isi nama tamu.");
  const last = unwrap(
    await supabase
      .from("service_assignments")
      .select("position")
      .eq("service_id", serviceId)
      .order("position", { ascending: false })
      .limit(1),
  );
  const r = await supabase.from("service_assignments").insert({
    service_id: serviceId,
    role_name: role.trim(),
    person_id: person?.id || null,
    display_name: person?.name || guest.trim(),
    position: (last[0]?.position ?? -1) + 1,
  });
  if (r.error) throw new Error(r.error.message);
}
export async function deleteRow(
  table:
    | "service_assignments"
    | "setlist_items"
    | "service_notes"
    | "media_references",
  id: string,
): Promise<void> {
  const r = await supabase.from(table).delete().eq("id", id);
  if (r.error) throw new Error(r.error.message);
}
export async function addNote(
  serviceId: string,
  userId: string,
  body: string,
): Promise<void> {
  if (!body.trim()) throw new Error("Catatan wajib diisi.");
  const r = await supabase
    .from("service_notes")
    .insert({ service_id: serviceId, created_by: userId, body: body.trim() });
  if (r.error) throw new Error(r.error.message);
}
export async function addMedia(
  serviceId: string,
  label: string,
  url: string,
): Promise<void> {
  if (!label.trim() || !/^https?:\/\//.test(url))
    throw new Error("Isi label dan URL referensi yang valid.");
  const r = await supabase
    .from("media_references")
    .insert({ service_id: serviceId, label: label.trim(), url });
  if (r.error) throw new Error(r.error.message);
}
export async function listSongs(): Promise<Song[]> {
  const songs = unwrap(
    await supabase
      .from("songs")
      .select("*,song_references(*)")
      .eq("team_id", churchId)
      .order("title"),
  ) as Song[];
  return songs.map((song) => ({
    ...song,
    song_references: song.song_references.sort(
      (a, b) => (a.position || 0) - (b.position || 0),
    ),
  }));
}
export async function getSong(id: string): Promise<Song> {
  const song = unwrap(
    await supabase
      .from("songs")
      .select("*,song_references(*)")
      .eq("id", id)
      .eq("team_id", churchId)
      .single(),
  ) as Song;
  song.song_references.sort((a, b) => (a.position || 0) - (b.position || 0));
  return song;
}
export function bpmValue(value: string): number | null {
  if (!value.trim()) return null;
  const bpm = Number(value);
  if (!Number.isInteger(bpm) || bpm < 20 || bpm > 400)
    throw new Error("BPM harus bilangan bulat 20–400.");
  return bpm;
}
export function signatureValue(value: string): string {
  if (!value.trim()) return defaultMeter(value);
  if (!/^([1-9][0-9]*)\/([1-9][0-9]*)$/.test(value.trim()))
    throw new Error("Gunakan birama seperti 4/4 atau 6/8.");
  return value.trim();
}
export interface SongInput {
  title: string;
  artist: string;
  key: string;
  bpm: string;
  time_signature: string;
  lyrics: string;
  writer_credits: string;
  copyright_notice: string;
}
export async function saveSong(
  id: string | null,
  data: SongInput,
  references: Reference[],
): Promise<string> {
  if (!data.title.trim()) throw new Error("Judul lagu wajib diisi.");
  references.forEach((r) => {
    if (!r.label.trim() || !youtubeId(r.url))
      throw new Error("Isi label dan tautan video YouTube yang valid.");
  });
  return (await rpc("save_library_song", {
    target_team_id: churchId,
    target_song_id: id,
    song_data: {
      ...data,
      bpm: bpmValue(data.bpm),
      time_signature: signatureValue(data.time_signature),
    },
    references_data: references,
  })) as string;
}
export async function addSongToSetlist(
  serviceId: string,
  songId: string,
): Promise<void> {
  await rpc("append_service_songs", {
    target_service_id: serviceId,
    canonical_song_id: songId,
  });
}
export async function addProposals(
  serviceId: string,
  raw: string,
): Promise<void> {
  const seen = new Set<string>();
  const proposals = raw
    .split("\n")
    .map((title) => title.replace(/\s+/g, " ").trim())
    .filter((title) => {
      const key = title.toLowerCase();
      if (!title || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (!proposals.length || proposals.length > 50)
    throw new Error("Isi 1–50 judul lagu, satu judul per baris.");
  await rpc("append_service_songs", {
    target_service_id: serviceId,
    proposals,
  });
}
export async function moveSetlistItem(
  id: string,
  direction: "up" | "down",
  revision: number,
): Promise<void> {
  await rpc("move_setlist_item", {
    item_id: id,
    move_direction: direction,
    expected_revision: revision,
  });
}
export async function addReviewedSongs(
  serviceId: string,
  revision: number,
  entries: ReviewedSongEntry[],
): Promise<void> {
  await rpc("append_reviewed_service_songs", {
    target_service_id: serviceId,
    expected_revision: revision,
    reviewed_entries: entries,
  });
}
export function parseStructure(text: string): SongStructureSection[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [section, raw, ...extra] = line
        .split("|")
        .map((part) => part.trim());
      if (
        !section ||
        extra.length ||
        (raw && (!Number.isInteger(Number(raw)) || Number(raw) <= 0))
      )
        throw new Error("Struktur: Bagian atau Bagian | jumlah bar positif.");
      return { section, bars: raw ? Number(raw) : null };
    });
}
export interface ArrangementInput {
  key: string;
  bpm: string;
  signature: string;
  structure: string;
  lyrics: string;
  url: string;
  notes: string;
}
export async function saveArrangement(
  id: string,
  input: ArrangementInput,
): Promise<void> {
  if (input.url.trim() && !/^https?:\/\//.test(input.url))
    throw new Error("URL aransemen tidak valid.");
  const r = await supabase
    .from("setlist_items")
    .update({
      key: input.key.trim() || null,
      bpm: bpmValue(input.bpm),
      time_signature: signatureValue(input.signature),
      structure: parseStructure(input.structure),
      lyrics_or_chords: input.lyrics,
      arrangement_url: input.url.trim() || null,
      notes: input.notes.trim() || null,
    })
    .eq("id", id);
  if (r.error) throw new Error(r.error.message);
}

// One atomic arrangement update; canonical songs and other services are untouched.
// Selecting the updated row also detects a rejected/no-op RLS update.
export async function saveSetlistSettings(
  id: string,
  input: {
    title: string;
    key: string;
    bpm: string;
    signature: string;
    notes: string;
  },
): Promise<void> {
  const title = requiredSongTitle(input.title);
  const r = await supabase
    .from("setlist_items")
    .update({
      proposed_title: title,
      key: input.key.trim() || null,
      bpm: bpmValue(input.bpm),
      time_signature: signatureValue(input.signature),
      notes: input.notes.trim() || null,
    })
    .eq("id", id)
    .select("id")
    .single();
  if (r.error) throw new Error(r.error.message);
}
