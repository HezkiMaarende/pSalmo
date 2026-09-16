export function jakartaDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function upcomingSunday(now = new Date()): string {
  const date = new Date(`${jakartaDay(now)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + ((7 - date.getUTCDay()) % 7));
  return date.toISOString().slice(0, 10);
}
export function monthSundays(month: string): string[] {
  const date = new Date(`${month}-01T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 7) !== month)
    throw new Error("Bulan tidak valid.");
  date.setUTCDate(1 + ((7 - date.getUTCDay()) % 7));
  const days: string[] = [];
  while (date.toISOString().slice(0, 7) === month) {
    days.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 7);
  }
  return days;
}
export function shiftMonth(month: string, change: number): string {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + change);
  return date.toISOString().slice(0, 7);
}
export function dateLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
export function weekLabel(day: string): string {
  return `MINGGU ${monthSundays(day.slice(0, 7)).indexOf(day) + 1}`;
}
