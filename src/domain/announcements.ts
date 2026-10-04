import { jakartaDay } from "./calendar";

export interface Announcement {
  id: string;
  team_id: string;
  title: string;
  body: string;
  external_url: string | null;
  pinned: boolean;
  expires_on: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  external_url: string;
  pinned: boolean;
  expires_on: string;
}

export type AnnouncementFilter = "published" | "draft" | "archived";
export type AnnouncementAction =
  | "publish"
  | "unpublish"
  | "archive"
  | "restore";

export function validCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function normalizeAnnouncementInput(input: AnnouncementInput) {
  const title = input.title.replace(/\s+/g, " ").trim();
  const body = input.body.trim();
  const externalUrl = input.external_url.trim();
  const expiresOn = input.expires_on.trim();
  if (!title) throw new Error("Judul pengumuman wajib diisi.");
  if (title.length > 120)
    throw new Error("Judul pengumuman maksimal 120 karakter.");
  if (!body) throw new Error("Isi pengumuman wajib diisi.");
  if (body.length > 5000)
    throw new Error("Isi pengumuman maksimal 5.000 karakter.");
  if (externalUrl && !/^https:\/\/\S+$/.test(externalUrl))
    throw new Error("Tautan pengumuman harus menggunakan HTTPS.");
  if (expiresOn && !validCalendarDay(expiresOn))
    throw new Error("Tanggal kedaluwarsa harus berformat YYYY-MM-DD.");
  return {
    title,
    body,
    external_url: externalUrl || null,
    pinned: input.pinned,
    expires_on: expiresOn || null,
  };
}

export function isAnnouncementActive(
  item: Announcement,
  now = new Date(),
): boolean {
  return (
    !!item.published_at &&
    !item.archived_at &&
    (!item.expires_on || item.expires_on >= jakartaDay(now))
  );
}

export function announcementFilter(item: Announcement): AnnouncementFilter {
  if (item.archived_at) return "archived";
  return item.published_at ? "published" : "draft";
}

export function sortAnnouncements(items: Announcement[]): Announcement[] {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const published = (b.published_at || "").localeCompare(
      a.published_at || "",
    );
    if (published) return published;
    const updated = b.updated_at.localeCompare(a.updated_at);
    return updated || a.id.localeCompare(b.id);
  });
}

export function activeAnnouncements(
  items: Announcement[],
  now = new Date(),
): Announcement[] {
  return sortAnnouncements(
    items.filter((item) => isAnnouncementActive(item, now)),
  );
}

export function homeAnnouncements(
  items: Announcement[],
  now = new Date(),
): Announcement[] {
  return activeAnnouncements(items, now).slice(0, 3);
}

export function announcementSummary(body: string, maximum = 160): string {
  const value = body.replace(/\s+/g, " ").trim();
  if (value.length <= maximum) return value;
  return `${value.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
}
