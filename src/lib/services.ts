import { supabase } from "./supabase";
import type { MembershipRole, ServiceStatus, ServiceType, SongStructureSection } from "../domain/service";

export interface Team {
  id: string;
  name: string;
  role: MembershipRole;
}

export interface TeamMember {
  id: string;
  displayName: string;
  role: MembershipRole;
}

export interface TeamInvite {
  id: string;
  role: MembershipRole;
  expiresAt: string;
  revokedAt: string | null;
  usedAt: string | null;
}

export interface Song {
  id: string;
  team_id: string;
  title: string;
  artist: string | null;
  default_key: string | null;
  default_bpm: number | null;
}

export interface Service {
  id: string;
  team_id: string;
  title: string;
  service_type: ServiceType;
  service_date: string;
  status: ServiceStatus;
}

export interface ServiceDetail {
  service: Service;
  assignments: Array<{ id: string; user_id: string | null; role_name: string; display_name: string | null; position: number }>;
  notes: Array<{ id: string; body: string }>;
  media: Array<{ id: string; label: string; url: string }>;
  items: Array<{
    id: string;
    position: number;
    song_id: string | null;
    song_title: string | null;
    proposed_title: string | null;
    artist: string | null;
    key: string | null;
    bpm: number | null;
    time_signature: string | null;
    structure: SongStructureSection[];
    lyrics_or_chords: string | null;
    arrangement_url: string | null;
    notes: string | null;
  }>;
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("The requested data is unavailable.");
  return result.data;
}

export async function listTeams(): Promise<Team[]> {
  const memberships = unwrap(await supabase.from("team_memberships")
    .select("team_id, role").order("joined_at"));
  if (!memberships.length) return [];
  const teamIds = memberships.map((row) => row.team_id);
  const teams = unwrap(await supabase.from("teams").select("id, name").in("id", teamIds));
  return memberships.flatMap((membership) => {
    const team = teams.find((candidate) => candidate.id === membership.team_id);
    return team ? [{ ...team, role: membership.role as MembershipRole }] : [];
  });
}

export async function createTeam(name: string): Promise<Team> {
  // An INSERT ... RETURNING issued directly through PostgREST evaluates the
  // team's SELECT policy before the after-insert owner-membership trigger runs.
  // This RPC returns only after that trigger has completed.
  const result = await supabase.rpc("create_team", { team_name: name.trim() }).single();
  if (result.error) throw new Error(result.error.message);
  const row = result.data as { id: string; name: string } | null;
  if (!row) throw new Error("Team creation returned no data.");
  return { id: row.id, name: row.name, role: "owner" };
}

export async function listServices(teamId: string): Promise<Service[]> {
  return unwrap(await supabase.from("services")
    .select("id, team_id, title, service_type, service_date, status")
    .eq("team_id", teamId).order("service_date", { ascending: false })) as Service[];
}

export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
  const memberships = unwrap(await supabase.from("team_memberships")
    .select("user_id, role").eq("team_id", teamId));
  const memberIds = memberships.map((member) => member.user_id);
  if (!memberIds.length) return [];
  const profiles = unwrap(await supabase.from("profiles")
    .select("id, display_name").in("id", memberIds));
  return memberships.flatMap((membership) => {
    const id = membership.user_id;
    const profile = profiles.find((candidate) => candidate.id === id);
    return profile ? [{ id, displayName: profile.display_name || "Team member", role: membership.role as MembershipRole }] : [];
  });
}

export async function listTeamInvites(teamId: string): Promise<TeamInvite[]> {
  return unwrap(await supabase.from("invites")
    .select("id, role, expires_at, revoked_at, used_at").eq("team_id", teamId).order("created_at", { ascending: false }))
    .map((invite) => ({
      id: invite.id,
      role: invite.role as MembershipRole,
      expiresAt: invite.expires_at,
      revokedAt: invite.revoked_at,
      usedAt: invite.used_at,
    }));
}

export async function createTeamInvite(teamId: string, role: MembershipRole, validForHours: number): Promise<{ token: string; expiresAt: string; role: MembershipRole }> {
  if (!Number.isInteger(validForHours) || validForHours < 1 || validForHours > 24 * 30) {
    throw new Error("Invite expiry must be a whole number between 1 and 720 hours.");
  }
  if (role === "owner") throw new Error("An invite cannot grant owner access.");
  const result = await supabase.rpc("create_team_invite", {
    target_team_id: teamId, target_role: role, valid_for_hours: validForHours,
  }).single();
  if (result.error) throw new Error(result.error.message);
  const invite = result.data as { token: string; expires_at: string; role: MembershipRole } | null;
  if (!invite) throw new Error("Invite creation returned no token.");
  return { token: invite.token, expiresAt: invite.expires_at, role: invite.role };
}

export async function acceptTeamInvite(token: string): Promise<Team> {
  if (!token.trim()) throw new Error("Enter an invitation code.");
  const result = await supabase.rpc("accept_team_invite", { invite_token: token.trim() }).single();
  if (result.error) throw new Error(result.error.message);
  const joined = result.data as { team_id: string; team_name: string; role: MembershipRole } | null;
  if (!joined) throw new Error("Invitation acceptance returned no team.");
  return { id: joined.team_id, name: joined.team_name, role: joined.role };
}

export async function setTeamMemberRole(teamId: string, userId: string, role: MembershipRole): Promise<void> {
  if (role === "owner") throw new Error("Owner access cannot be assigned here.");
  const result = await supabase.rpc("set_team_member_role", { target_team_id: teamId, target_user_id: userId, new_role: role });
  if (result.error) throw new Error(result.error.message);
}

export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const result = await supabase.rpc("remove_team_member", { target_team_id: teamId, target_user_id: userId });
  if (result.error) throw new Error(result.error.message);
}

export async function revokeTeamInvite(inviteId: string): Promise<void> {
  const result = await supabase.rpc("revoke_team_invite", { target_invite_id: inviteId });
  if (result.error) throw new Error(result.error.message);
}

export async function listSongs(teamId: string): Promise<Song[]> {
  return unwrap(await supabase.from("songs")
    .select("id, team_id, title, artist, default_key, default_bpm")
    .eq("team_id", teamId).order("title")) as Song[];
}

export async function createSong(
  teamId: string, userId: string, title: string, artist: string, defaultKey: string, defaultBpm: string,
): Promise<Song> {
  const bpm = defaultBpm.trim() ? Number(defaultBpm) : null;
  if (bpm !== null && (!Number.isInteger(bpm) || bpm < 20 || bpm > 400)) {
    throw new Error("BPM must be a whole number from 20 to 400.");
  }
  return unwrap(await supabase.from("songs").insert({
    team_id: teamId, created_by: userId, title: title.trim(), artist: artist.trim() || null,
    default_key: defaultKey.trim() || null, default_bpm: bpm,
  }).select("id, team_id, title, artist, default_key, default_bpm").single()) as Song;
}

export async function createService(
  teamId: string, userId: string, title: string, type: ServiceType, date: Date,
): Promise<Service> {
  return unwrap(await supabase.from("services").insert({
    team_id: teamId,
    created_by: userId,
    title: title.trim(),
    service_type: type,
    service_date: date.toISOString(),
  }).select("id, team_id, title, service_type, service_date, status").single()) as Service;
}

export async function updateServiceStatus(serviceId: string, status: ServiceStatus): Promise<Service> {
  return unwrap(await supabase.from("services").update({ status }).eq("id", serviceId)
    .select("id, team_id, title, service_type, service_date, status").single()) as Service;
}

export async function getServiceDetail(service: Service): Promise<ServiceDetail> {
  const [assignmentsResult, notesResult, mediaResult, setlistResult] = await Promise.all([
    supabase.from("service_assignments").select("id, user_id, role_name, display_name, position")
      .eq("service_id", service.id).order("position"),
    supabase.from("service_notes").select("id, body").eq("service_id", service.id).order("created_at"),
    supabase.from("media_references").select("id, label, url").eq("service_id", service.id).order("position"),
    supabase.from("setlists").select("id").eq("service_id", service.id).maybeSingle(),
  ]);
  if (setlistResult.error) throw new Error(setlistResult.error.message);
  const rawItems = setlistResult.data
    ? unwrap(await supabase.from("setlist_items")
      .select("id, position, song_id, proposed_title, artist, key, bpm, time_signature, structure, lyrics_or_chords, arrangement_url, notes")
      .eq("setlist_id", setlistResult.data.id).order("position"))
    : [];
  const songIds = rawItems.flatMap((item) => item.song_id ? [item.song_id] : []);
  const songs = songIds.length ? unwrap(await supabase.from("songs").select("id, title").in("id", songIds)) : [];
  const items = rawItems.map((item) => ({
    ...item,
    song_title: item.song_id ? songs.find((song) => song.id === item.song_id)?.title || null : null,
  }));
  return {
    service,
    assignments: unwrap(assignmentsResult),
    notes: unwrap(notesResult),
    media: unwrap(mediaResult),
    items,
  };
}

export async function addAssignment(
  serviceId: string, roleName: string, displayName: string, userId?: string,
): Promise<void> {
  const result = await supabase.from("service_assignments").insert({
    service_id: serviceId,
    role_name: roleName.trim(),
    display_name: displayName.trim() || null,
    user_id: userId || null,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function deleteAssignment(id: string): Promise<void> {
  const result = await supabase.from("service_assignments").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

export async function addNote(serviceId: string, userId: string, body: string): Promise<void> {
  const result = await supabase.from("service_notes").insert({ service_id: serviceId, created_by: userId, body: body.trim() });
  if (result.error) throw new Error(result.error.message);
}

export async function deleteNote(id: string): Promise<void> {
  const result = await supabase.from("service_notes").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

export async function addMediaReference(serviceId: string, label: string, url: string): Promise<void> {
  const existing = unwrap(await supabase.from("media_references").select("position").eq("service_id", serviceId)
    .order("position", { ascending: false }).limit(1));
  const result = await supabase.from("media_references").insert({
    service_id: serviceId, label: label.trim(), url: url.trim(), position: (existing[0]?.position ?? -1) + 1,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function deleteMediaReference(id: string): Promise<void> {
  const result = await supabase.from("media_references").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

export async function addSetlistItem(service: Service, title: string): Promise<void> {
  await bulkAddSetlistItems(service, [title]);
}

export async function bulkAddSetlistItems(service: Service, rawTitles: string[]): Promise<number> {
  const seen = new Set<string>();
  const titles = rawTitles.map((title) => title.replace(/\s+/g, " ").trim()).filter((title) => {
    const key = title.toLocaleLowerCase();
    if (!title || seen.has(key)) return false;
    seen.add(key); return true;
  });
  if (!titles.length) throw new Error("Enter at least one song title.");
  if (titles.length > 50) throw new Error("Add no more than 50 songs at once.");
  const setlistId = await ensureSetlist(service);
  const existing = unwrap(await supabase.from("setlist_items").select("position").eq("setlist_id", setlistId)
    .order("position", { ascending: false }).limit(1));
  const firstPosition = (existing[0]?.position ?? -1) + 1;
  const result = await supabase.from("setlist_items").insert(titles.map((title, index) => ({
    setlist_id: setlistId, proposed_title: title, position: firstPosition + index,
  })));
  if (result.error) throw new Error(result.error.message);
  return titles.length;
}

async function ensureSetlist(service: Service): Promise<string> {
  let setlist = await supabase.from("setlists").select("id").eq("service_id", service.id).maybeSingle();
  if (setlist.error) throw new Error(setlist.error.message);
  if (!setlist.data) {
    setlist = await supabase.from("setlists").insert({ service_id: service.id, title: `${service.title} setlist` }).select("id").single();
    if (setlist.error || !setlist.data) throw new Error(setlist.error?.message || "Could not create the setlist.");
  }
  return setlist.data.id;
}

export async function addSongToSetlist(service: Service, song: Song): Promise<void> {
  const setlistId = await ensureSetlist(service);
  const existing = unwrap(await supabase.from("setlist_items").select("position").eq("setlist_id", setlistId)
    .order("position", { ascending: false }).limit(1));
  const result = await supabase.from("setlist_items").insert({
    setlist_id: setlistId, song_id: song.id, artist: song.artist,
    key: song.default_key, bpm: song.default_bpm, position: (existing[0]?.position ?? -1) + 1,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function deleteSetlistItem(id: string): Promise<void> {
  const result = await supabase.from("setlist_items").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

export interface SetlistArrangementInput {
  key: string;
  bpm: string;
  timeSignature: string;
  structure: SongStructureSection[];
  lyricsOrChords: string;
  arrangementUrl: string;
  notes: string;
}

export async function updateSetlistArrangement(id: string, input: SetlistArrangementInput): Promise<void> {
  const bpm = input.bpm.trim() ? Number(input.bpm) : null;
  if (bpm !== null && (!Number.isInteger(bpm) || bpm < 20 || bpm > 400)) {
    throw new Error("BPM must be a whole number from 20 to 400.");
  }
  const timeSignature = input.timeSignature.trim();
  if (timeSignature && !/^([1-9][0-9]*)\/([1-9][0-9]*)$/.test(timeSignature)) {
    throw new Error("Time signature must use the form 4/4.");
  }
  const arrangementUrl = input.arrangementUrl.trim();
  if (arrangementUrl) {
    try { new URL(arrangementUrl); } catch { throw new Error("Arrangement link must be a valid absolute URL."); }
  }
  const result = await supabase.from("setlist_items").update({
    key: input.key.trim() || null, bpm, time_signature: timeSignature || null,
    structure: input.structure, lyrics_or_chords: input.lyricsOrChords.trim() || null,
    arrangement_url: arrangementUrl || null, notes: input.notes.trim() || null,
  }).eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

export async function moveSetlistItem(id: string, direction: "up" | "down"): Promise<void> {
  const result = await supabase.rpc("move_setlist_item", { item_id: id, move_direction: direction });
  if (result.error) throw new Error(result.error.message);
}
