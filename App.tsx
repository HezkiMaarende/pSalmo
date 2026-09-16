import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { isConfigured, supabase } from "./src/lib/supabase";
import { addAssignment, addMediaReference, addNote, addSetlistItem, createService, createTeam, deleteAssignment, deleteMediaReference, deleteNote, deleteSetlistItem, getServiceDetail, listServices, listTeamMembers, listTeams, moveSetlistItem, type Service, type ServiceDetail, type Team, type TeamMember } from "./src/lib/services";
import type { ServiceType } from "./src/domain/service";

function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

function Field({ label, value, onChangeText, secure = false }: { label: string; value: string; onChangeText: (value: string) => void; secure?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} autoCapitalize="none" secureTextEntry={secure} value={value} onChangeText={onChangeText} style={styles.input} /></View>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [service, setService] = useState<Service | null>(null);
  const [detail, setDetail] = useState<ServiceDetail | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newServiceTitle, setNewServiceTitle] = useState("");
  const [newServiceDate, setNewServiceDate] = useState("");
  const [newServiceType, setNewServiceType] = useState<ServiceType>("ir_1_2");
  const [assignmentRole, setAssignmentRole] = useState("");
  const [assignmentName, setAssignmentName] = useState("");
  const [assignmentMemberId, setAssignmentMemberId] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [mediaLabel, setMediaLabel] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [songTitle, setSongTitle] = useState("");

  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!isConfigured) { setBooting(false); return; }
    supabase.auth.getSession().then(({ data, error: authError }) => {
      setSession(data.session); if (authError) setError(authError.message); setBooting(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) { setTeam(null); setTeams([]); setServices([]); setService(null); setDetail(null); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) void run(async () => setTeams(await listTeams())); }, [session?.user.id]);
  useEffect(() => {
    if (!team) { setTeamMembers([]); return; }
    void run(async () => {
      const [loadedServices, loadedMembers] = await Promise.all([listServices(team.id), listTeamMembers(team.id)]);
      setServices(loadedServices); setTeamMembers(loadedMembers);
    });
  }, [team?.id]);
  useEffect(() => {
    if (!service) { setDetail(null); return; }
    void run(async () => setDetail(await getServiceDetail(service)));
  }, [service?.id]);

  function auth(mode: "signIn" | "signUp") {
    void run(async () => {
      if (!email.trim() || password.length < 6) throw new Error("Enter an email and a password of at least 6 characters.");
      const result = mode === "signIn" ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (mode === "signUp" && !result.data.session) Alert.alert("Check your email", "Confirm your address, then sign in.");
    });
  }

  function addTeam() {
    void run(async () => {
      if (!session || !newTeamName.trim()) throw new Error("Enter a team name.");
      const created = await createTeam(newTeamName);
      setTeams((current) => [...current, created]); setTeam(created); setNewTeamName("");
    });
  }

  function addService() {
    void run(async () => {
      if (!session || !team || !newServiceTitle.trim()) throw new Error("Enter a service title.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newServiceDate)) throw new Error("Use YYYY-MM-DD for the service date.");
      const date = new Date(`${newServiceDate}T00:00:00+07:00`);
      if (Number.isNaN(date.getTime()) || new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) !== newServiceDate) {
        throw new Error("Enter a valid service date.");
      }
      const created = await createService(team.id, session.user.id, newServiceTitle, newServiceType, date);
      setServices((current) => [created, ...current]); setNewServiceTitle(""); setNewServiceDate(""); setService(created);
    });
  }

  const canManageService = Boolean(team && team.role !== "member");

  async function refreshDetail() {
    if (!service) return;
    setDetail(await getServiceDetail(service));
  }

  function changeWorkspace(action: () => Promise<void>) {
    void run(async () => { await action(); await refreshDetail(); });
  }

  function saveAssignment() {
    changeWorkspace(async () => {
      if (!service || !assignmentRole.trim()) throw new Error("Enter a temporary role, such as WL or bass.");
      const selected = teamMembers.find((member) => member.id === assignmentMemberId);
      await addAssignment(service.id, assignmentRole, selected?.displayName || assignmentName, selected?.id);
      setAssignmentRole(""); setAssignmentName(""); setAssignmentMemberId(null);
    });
  }

  function saveNote() {
    changeWorkspace(async () => {
      if (!service || !session || !noteBody.trim()) throw new Error("Enter a shared note.");
      await addNote(service.id, session.user.id, noteBody); setNoteBody("");
    });
  }

  function saveMedia() {
    changeWorkspace(async () => {
      if (!service || !mediaLabel.trim() || !mediaUrl.trim()) throw new Error("Enter both a label and a URL.");
      try { new URL(mediaUrl); } catch { throw new Error("Enter a valid absolute URL."); }
      await addMediaReference(service.id, mediaLabel, mediaUrl); setMediaLabel(""); setMediaUrl("");
    });
  }

  function saveSong() {
    changeWorkspace(async () => {
      if (!service || !songTitle.trim()) throw new Error("Enter a song title.");
      await addSetlistItem(service, songTitle); setSongTitle("");
    });
  }

  return <SafeAreaView style={styles.safe}><StatusBar style="light" /><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.brand}>pSalmo</Text><Text style={styles.title}>Sunday Service</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {busy || booting ? <ActivityIndicator color="#A7F3D0" /> : null}
    {!isConfigured ? <Section title="Set up this app"><Text style={styles.body}>Add the Supabase URL and publishable key to .env, then restart Expo.</Text></Section>
      : booting ? null : !session ? <Section title="Sign in">
        <Field label="Email" value={email} onChangeText={setEmail} /><Field label="Password" value={password} onChangeText={setPassword} secure />
        <Button label="Sign in" onPress={() => auth("signIn")} disabled={busy} /><Button label="Create account" onPress={() => auth("signUp")} disabled={busy} />
      </Section> : <>
        <View style={styles.topline}><Text style={styles.body}>{session.user.email}</Text><Pressable accessibilityRole="button" onPress={() => void run(async () => { const result = await supabase.auth.signOut(); if (result.error) throw result.error; })}><Text style={styles.link}>Sign out</Text></Pressable></View>
        {service && detail ? <>
          <Button label="All services" onPress={() => setService(null)} />
          <Text style={styles.heading}>{service.title}</Text><Text style={styles.meta}>{new Date(service.service_date).toLocaleDateString("id-ID")} · {service.service_type === "ir_3" ? "Ibadah Raya 3" : "Ibadah Raya 1 & 2"} · {service.status}</Text>
          <Section title="Roster">{detail.assignments.length ? detail.assignments.map((entry) => <View key={entry.id} style={styles.actionRow}><Text style={styles.row}>{entry.role_name}: {entry.display_name || "Assigned member"}</Text>{canManageService ? <Pressable accessibilityRole="button" onPress={() => changeWorkspace(() => deleteAssignment(entry.id))}><Text style={styles.danger}>Remove</Text></Pressable> : null}</View>) : <Text style={styles.muted}>No assignments yet.</Text>}
            {canManageService ? <><Field label="Temporary role" value={assignmentRole} onChangeText={setAssignmentRole} /><Field label="Name (for a guest or manual entry)" value={assignmentName} onChangeText={setAssignmentName} />
              {teamMembers.length ? <View style={styles.memberChoices}>{teamMembers.map((member) => <Pressable key={member.id} accessibilityRole="button" onPress={() => { setAssignmentMemberId(member.id); setAssignmentName(""); }} style={[styles.choice, assignmentMemberId === member.id && styles.choiceSelected]}><Text style={styles.choiceText}>{member.displayName}</Text></Pressable>)}</View> : null}
              <Button label="Add assignment" onPress={saveAssignment} disabled={busy} /></> : null}</Section>
          <Section title="Setlist">{detail.items.length ? detail.items.map((entry) => <View key={entry.id} style={styles.actionRow}><Text style={styles.row}>{entry.position + 1}. {entry.proposed_title || "Song Bank song"}{entry.artist ? ` · ${entry.artist}` : ""}{entry.key ? ` · ${entry.key}` : ""}{entry.bpm ? ` · ${entry.bpm} BPM` : ""}</Text>{canManageService ? <View style={styles.controls}><Pressable accessibilityRole="button" onPress={() => changeWorkspace(() => moveSetlistItem(entry.id, "up"))}><Text style={styles.link}>↑</Text></Pressable><Pressable accessibilityRole="button" onPress={() => changeWorkspace(() => moveSetlistItem(entry.id, "down"))}><Text style={styles.link}>↓</Text></Pressable><Pressable accessibilityRole="button" onPress={() => changeWorkspace(() => deleteSetlistItem(entry.id))}><Text style={styles.danger}>Remove</Text></Pressable></View> : null}</View>) : <Text style={styles.muted}>No songs yet.</Text>}
            {canManageService ? <><Field label="Song title" value={songTitle} onChangeText={setSongTitle} /><Button label="Add song" onPress={saveSong} disabled={busy} /></> : null}</Section>
          <Section title="Shared notes">{detail.notes.length ? detail.notes.map((entry) => <View key={entry.id} style={styles.actionRow}><Text style={styles.row}>{entry.body}</Text>{canManageService ? <Pressable accessibilityRole="button" onPress={() => changeWorkspace(() => deleteNote(entry.id))}><Text style={styles.danger}>Remove</Text></Pressable> : null}</View>) : <Text style={styles.muted}>No notes yet.</Text>}
            {canManageService ? <><Field label="New shared note" value={noteBody} onChangeText={setNoteBody} /><Button label="Add note" onPress={saveNote} disabled={busy} /></> : null}</Section>
          <Section title="Media references">{detail.media.length ? detail.media.map((entry) => <View key={entry.id} style={styles.actionRow}><Text style={styles.row}>{entry.label}: {entry.url}</Text>{canManageService ? <Pressable accessibilityRole="button" onPress={() => changeWorkspace(() => deleteMediaReference(entry.id))}><Text style={styles.danger}>Remove</Text></Pressable> : null}</View>) : <Text style={styles.muted}>No references yet.</Text>}
            {canManageService ? <><Field label="Reference label" value={mediaLabel} onChangeText={setMediaLabel} /><Field label="Reference URL" value={mediaUrl} onChangeText={setMediaUrl} /><Button label="Add reference" onPress={saveMedia} disabled={busy} /></> : null}</Section>
        </> : team ? <>
          <Button label="Teams" onPress={() => { setTeam(null); setService(null); }} />
          <Text style={styles.heading}>{team.name}</Text><Text style={styles.meta}>Permission role: {team.role}</Text>
          <Section title="Weekly services">{services.length ? services.map((entry) => <Pressable key={entry.id} accessibilityRole="button" onPress={() => setService(entry)} style={styles.card}><Text style={styles.row}>{entry.title}</Text><Text style={styles.meta}>{new Date(entry.service_date).toLocaleDateString("id-ID")} · {entry.status}</Text></Pressable>) : <Text style={styles.muted}>No services yet.</Text>}</Section>
          {team.role !== "member" ? <Section title="New service"><Field label="Title" value={newServiceTitle} onChangeText={setNewServiceTitle} /><Field label="Date (YYYY-MM-DD)" value={newServiceDate} onChangeText={setNewServiceDate} />
            <View style={styles.topline}><Pressable onPress={() => setNewServiceType("ir_1_2")}><Text style={styles.link}>IR 1 & 2 {newServiceType === "ir_1_2" ? "✓" : ""}</Text></Pressable><Pressable onPress={() => setNewServiceType("ir_3")}><Text style={styles.link}>IR 3 {newServiceType === "ir_3" ? "✓" : ""}</Text></Pressable></View>
            <Button label="Create service" onPress={addService} disabled={busy} /></Section> : null}
        </> : <><Section title="Your teams">{teams.length ? teams.map((entry) => <Pressable key={entry.id} accessibilityRole="button" onPress={() => setTeam(entry)} style={styles.card}><Text style={styles.row}>{entry.name}</Text><Text style={styles.meta}>{entry.role}</Text></Pressable>) : <Text style={styles.muted}>You are not in a team yet.</Text>}</Section>
          <Section title="Create a team"><Field label="Team name" value={newTeamName} onChangeText={setNewTeamName} /><Button label="Create team" onPress={addTeam} disabled={busy} /></Section></>}
      </>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#111827" }, content: { padding: 24, paddingBottom: 60, gap: 18 },
  brand: { color: "#A7F3D0", fontSize: 20, fontWeight: "700" }, title: { color: "#FFFFFF", fontSize: 30, fontWeight: "800" },
  heading: { color: "#FFFFFF", fontSize: 25, fontWeight: "700" }, body: { color: "#E5E7EB", fontSize: 16, lineHeight: 24 },
  muted: { color: "#9CA3AF", fontSize: 15 }, meta: { color: "#9CA3AF", fontSize: 14, lineHeight: 20 },
  row: { color: "#F9FAFB", fontSize: 16, lineHeight: 25 }, link: { color: "#A7F3D0", fontSize: 15, fontWeight: "600" },
  error: { color: "#FECACA", backgroundColor: "#7F1D1D", padding: 12, borderRadius: 8 },
  section: { backgroundColor: "#1F2937", borderRadius: 16, padding: 18, gap: 14 }, sectionTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  card: { backgroundColor: "#374151", borderRadius: 12, padding: 14, gap: 4 }, field: { gap: 6 }, label: { color: "#D1D5DB", fontSize: 14 },
  input: { backgroundColor: "#374151", borderRadius: 8, color: "#FFFFFF", padding: 12, fontSize: 16 },
  button: { backgroundColor: "#047857", borderRadius: 10, padding: 14, alignItems: "center" }, buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.45 }, topline: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  actionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }, controls: { flexDirection: "row", gap: 12, alignItems: "center" },
  danger: { color: "#FCA5A5", fontSize: 14, fontWeight: "600" }, memberChoices: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { borderWidth: 1, borderColor: "#6B7280", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 }, choiceSelected: { borderColor: "#A7F3D0", backgroundColor: "#065F46" }, choiceText: { color: "#F9FAFB", fontSize: 14 },
});
