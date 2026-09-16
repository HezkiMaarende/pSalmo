import { supabase } from "./supabase";
import type { MembershipRole, ServiceStatus, ServiceType } from "../domain/service";

export interface Team {
  id: string;
  name: string;
  role: MembershipRole;
}

export interface TeamMember {
  id: string;
  displayName: string;
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
  assignments: Array<{ id: string; role_name: string; display_name: string | null; position: number }>;
  notes: Array<{ id: string; body: string }>;
  media: Array<{ id: string; label: string; url: string }>;
  items: Array<{
    id: string;
    position: number;
    proposed_title: string | null;
    artist: string | null;
    key: string | null;
    bpm: number | null;
    arrangement_url: string | null;
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

export async function createTeam(name: string, userId: string): Promise<Team> {
  const result = await supabase.from("teams")
    .insert({ name: name.trim(), created_by: userId }).select("id, name").single();
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
    .select("user_id").eq("team_id", teamId));
  const memberIds = memberships.map((member) => member.user_id);
  if (!memberIds.length) return [];
  const profiles = unwrap(await supabase.from("profiles")
    .select("id, display_name").in("id", memberIds));
  return memberIds.flatMap((id) => {
    const profile = profiles.find((candidate) => candidate.id === id);
    return profile ? [{ id, displayName: profile.display_name || "Team member" }] : [];
  });
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

export async function getServiceDetail(service: Service): Promise<ServiceDetail> {
  const [assignmentsResult, notesResult, mediaResult, setlistResult] = await Promise.all([
    supabase.from("service_assignments").select("id, role_name, display_name, position")
      .eq("service_id", service.id).order("position"),
    supabase.from("service_notes").select("id, body").eq("service_id", service.id).order("created_at"),
    supabase.from("media_references").select("id, label, url").eq("service_id", service.id).order("position"),
    supabase.from("setlists").select("id").eq("service_id", service.id).maybeSingle(),
  ]);
  if (setlistResult.error) throw new Error(setlistResult.error.message);
  const items = setlistResult.data
    ? unwrap(await supabase.from("setlist_items")
      .select("id, position, proposed_title, artist, key, bpm, arrangement_url")
      .eq("setlist_id", setlistResult.data.id).order("position"))
    : [];
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
  let setlist = await supabase.from("setlists").select("id").eq("service_id", service.id).maybeSingle();
  if (setlist.error) throw new Error(setlist.error.message);
  if (!setlist.data) {
    setlist = await supabase.from("setlists").insert({ service_id: service.id, title: `${service.title} setlist` }).select("id").single();
    if (setlist.error || !setlist.data) throw new Error(setlist.error?.message || "Could not create the setlist.");
  }
  const existing = unwrap(await supabase.from("setlist_items").select("position").eq("setlist_id", setlist.data.id)
    .order("position", { ascending: false }).limit(1));
  const result = await supabase.from("setlist_items").insert({
    setlist_id: setlist.data.id, proposed_title: title.trim(), position: (existing[0]?.position ?? -1) + 1,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function deleteSetlistItem(id: string): Promise<void> {
  const result = await supabase.from("setlist_items").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

export async function moveSetlistItem(id: string, direction: "up" | "down"): Promise<void> {
  const result = await supabase.rpc("move_setlist_item", { item_id: id, move_direction: direction });
  if (result.error) throw new Error(result.error.message);
}
