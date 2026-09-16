import { supabase } from "./supabase";
import type { MembershipRole, ServiceStatus, ServiceType } from "../domain/service";

export interface Team {
  id: string;
  name: string;
  role: MembershipRole;
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
