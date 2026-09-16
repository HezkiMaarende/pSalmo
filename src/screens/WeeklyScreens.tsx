import React, { useState } from "react";
import { Modal, View, Pressable, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Routes } from "../navigation/types";
import { homeMessage } from "../domain/weekly";
import { useChurch } from "../context/ChurchContext";
import * as api from "../lib/church";
import {
  dateLabel,
  jakartaDay,
  monthSundays,
  shiftMonth,
  upcomingSunday,
  weekLabel,
} from "../domain/calendar";
import {
  Page,
  Card,
  Title,
  Body,
  Button,
  Feedback,
  styles,
  useLoad,
  useAction,
} from "../components/ui";
type Props<K extends keyof Routes> = NativeStackScreenProps<Routes, K>;
export function Roster({ rows }: { rows: api.RosterRow[] }) {
  const grouped = new Map<string, string[]>();
  rows.forEach((r) =>
    grouped.set(r.role_name, [
      ...(grouped.get(r.role_name) || []),
      r.display_name || "—",
    ]),
  );
  return (
    <>
      {[...grouped].map(([role, names]) => (
        <View key={role} style={styles.divider}>
          <Text style={styles.role}>{role}</Text>
          <Text style={styles.person}>{names.join("\n")}</Text>
        </View>
      ))}
      {!rows.length && <Body muted>Petugas belum diisi.</Body>}
    </>
  );
}
export function HomeScreen({ navigation }: Props<"Home">) {
  const church = useChurch();
  const admin = church.membership?.role !== "member";
  const [drawer, setDrawer] = useState(false);
  const day = upcomingSunday();
  const state = useLoad(
    async () => ({
      weeks: await api.readSchedule(day, day),
      services: await api.visibleServices(day, day),
    }),
    [day, church.membership?.role, church.membership?.song_editor],
  );
  const action = useAction(state.reload);
  const week = state.data?.weeks[0];
  const assigned = week?.services.filter((s) => s.assigned) || [];
  // RLS already filters ordinary members to approved duties, and editors to their WL/MD duties.
  const services = state.data?.services || [];
  const message = homeMessage(admin, !!week?.published_at, assigned.length);
  return (
    <Page>
      <Button title="☰ Menu" onPress={() => setDrawer(true)} />
      <Title>Hello, {church.name}</Title>
      <Body>{dateLabel(day)}</Body>
      <Feedback loading={state.loading} error={state.error || action.error} />
      {state.data && (
        <>
          {message && <Body>{message}</Body>}
          {admin ? (
            (["ir_1_2", "ir_3"] as const).map((type) => {
              const service = services.find((s) => s.service_type === type);
              return (
                <Card key={type}>
                  <Title>
                    {type === "ir_1_2" ? "Ibadah Raya 1 & 2" : "Ibadah Raya 3"}
                  </Title>
                  {service ? (
                    <>
                      <Body muted>{service.status}</Body>
                      <Button
                        title="Buka ibadah"
                        onPress={() =>
                          navigation.navigate("Service", { id: service.id })
                        }
                      />
                    </>
                  ) : (
                    <Button
                      title="Buat ibadah"
                      disabled={action.busy}
                      onPress={() =>
                        void action.run(async () => {
                          const s = await api.createService(
                            day,
                            type,
                            church.session!.user.id,
                          );
                          navigation.navigate("Service", { id: s.id });
                        })
                      }
                    />
                  )}
                </Card>
              );
            })
          ) : (
            <>
              {services.map((s) => (
                <Card key={s.id}>
                  <Title>{s.title}</Title>
                  <Body muted>{s.status}</Body>
                  <Button
                    title="Buka ibadah"
                    onPress={() => navigation.navigate("Service", { id: s.id })}
                  />
                </Card>
              ))}
              {assigned
                .filter((s) => !s.can_open)
                .map((s) => (
                  <Card key={s.id}>
                    <Body>{s.title}</Body>
                    <Body muted>Daftar lagu belum disetujui PIC.</Body>
                  </Card>
                ))}
            </>
          )}
        </>
      )}
      <Modal
        visible={drawer}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawer(false)}
      >
        <View
          style={{ flex: 1, flexDirection: "row", backgroundColor: "#0006" }}
        >
          <View
            style={{
              width: "80%",
              maxWidth: 340,
              backgroundColor: "white",
              padding: 24,
              paddingTop: 54,
              gap: 16,
            }}
          >
            <Title>pSalmo</Title>
            <Body>{api.CHURCH_NAME}</Body>
            <Button title="Tutup menu" onPress={() => setDrawer(false)} />
            <Button
              title="Peraturan"
              onPress={() => {
                setDrawer(false);
                navigation.navigate("Rules");
              }}
            />
            {admin && (
              <>
                <Button
                  title="Kelola Petugas"
                  onPress={() => {
                    setDrawer(false);
                    navigation.navigate("People");
                  }}
                />
                <Button
                  title="Kelola Ibadah"
                  onPress={() => {
                    setDrawer(false);
                    navigation.navigate("ManageServices");
                  }}
                />
              </>
            )}
          </View>
          <Pressable
            accessibilityLabel="Tutup menu"
            accessibilityRole="button"
            style={{ flex: 1 }}
            onPress={() => setDrawer(false)}
          />
        </View>
      </Modal>
    </Page>
  );
}
export function MonthControl({
  month,
  setMonth,
}: {
  month: string;
  setMonth: (s: string) => void;
}) {
  return (
    <View style={styles.row}>
      <Button title="‹ Bulan" onPress={() => setMonth(shiftMonth(month, -1))} />
      <Body>
        {new Intl.DateTimeFormat("id-ID", {
          month: "long",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        }).format(new Date(`${month}-01T12:00:00Z`))}
      </Body>
      <Button title="Bulan ›" onPress={() => setMonth(shiftMonth(month, 1))} />
    </View>
  );
}
export function ScheduleScreen({ navigation }: Props<"Schedule">) {
  const [month, setMonth] = useState(jakartaDay().slice(0, 7));
  const days = monthSundays(month);
  const state = useLoad(
    () => api.readSchedule(days[0], days[days.length - 1]),
    [month],
  );
  return (
    <Page>
      <Title>Jadwal Pelayan</Title>
      <MonthControl month={month} setMonth={setMonth} />
      <Feedback loading={state.loading} error={state.error} />
      {days.map((day) => (
        <Card key={day}>
          <Title>{weekLabel(day)}</Title>
          <Body>{dateLabel(day)}</Body>
          <Body muted>
            {state.data?.find((w) => w.sunday === day)?.published_at
              ? "Diumumkan"
              : "Belum diumumkan"}
          </Body>
          <Button
            title="Lihat jadwal"
            onPress={() => navigation.navigate("Week", { day })}
          />
        </Card>
      ))}
    </Page>
  );
}
export function WeekScreen({ route, navigation }: Props<"Week">) {
  const { day } = route.params;
  const church = useChurch();
  const admin = church.membership?.role !== "member";
  const state = useLoad(() => api.readSchedule(day, day), [day]);
  const action = useAction(state.reload);
  const week = state.data?.[0];
  return (
    <Page>
      <Title>{api.CHURCH_NAME}</Title>
      <Body>{dateLabel(day).toUpperCase()}</Body>
      <Title>{weekLabel(day)}</Title>
      <Feedback loading={state.loading} error={state.error || action.error} />
      {state.data && (
        <>
          {!week?.published_at && (
            <Body>Jadwal minggu ini belum diumumkan.</Body>
          )}
          {admin && (
            <Button
              title={
                week?.published_at
                  ? "Tarik pengumuman jadwal"
                  : "Umumkan jadwal petugas"
              }
              disabled={action.busy}
              onPress={() =>
                void action.run(() => api.publishWeek(day, !week?.published_at))
              }
            />
          )}
          {([1, 2, 3] as const).map((number) => {
            const type = number === 3 ? "ir_3" : "ir_1_2";
            const s = week?.services.find((v) => v.service_type === type);
            return (
              <Card key={number}>
                <Title>IBADAH RAYA {number}</Title>
                <Roster rows={s?.roster || []} />
                {s?.can_open && (
                  <Button
                    title={s.can_edit ? "Siapkan ibadah" : "Buka ibadah"}
                    onPress={() => navigation.navigate("Service", { id: s.id })}
                  />
                )}
                {s && s.assigned && !s.can_open && (
                  <Body muted>Daftar lagu belum disetujui.</Body>
                )}
                {admin && !s && (
                  <Button
                    title={`Buat ${number === 3 ? "IR 3" : "IR 1 & 2"}`}
                    disabled={action.busy}
                    onPress={() =>
                      void action.run(async () => {
                        const created = await api.createService(
                          day,
                          type,
                          church.session!.user.id,
                        );
                        navigation.navigate("Service", { id: created.id });
                      })
                    }
                  />
                )}
              </Card>
            );
          })}
        </>
      )}
    </Page>
  );
}
export function ManageServicesScreen({ navigation }: Props<"ManageServices">) {
  const [month, setMonth] = useState(jakartaDay().slice(0, 7));
  const admin = useChurch().membership?.role !== "member";
  return (
    <Page>
      <Title>Kelola Ibadah</Title>
      {admin ? (
        <>
          <MonthControl month={month} setMonth={setMonth} />
          {monthSundays(month).map((day) => (
            <Card key={day}>
              <Body>
                {weekLabel(day)} · {dateLabel(day)}
              </Body>
              <Button
                title="Petugas & pengumuman"
                onPress={() => navigation.navigate("Week", { day })}
              />
            </Card>
          ))}
        </>
      ) : (
        <Body>Hanya PIC/admin.</Body>
      )}
    </Page>
  );
}
