const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const {
  activeAnnouncements,
  announcementFilter,
  announcementSummary,
  homeAnnouncements,
  isAnnouncementActive,
  normalizeAnnouncementInput,
  validCalendarDay,
} = require("../.test-build/announcements.js");

function announcement(id, overrides = {}) {
  return {
    id,
    team_id: "church",
    title: id,
    body: "Isi pengumuman",
    external_url: null,
    pinned: false,
    expires_on: null,
    published_at: "2026-10-01T00:00:00Z",
    archived_at: null,
    created_by: "owner",
    updated_by: "owner",
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

test("announcement input is trimmed and validates its public limits", () => {
  assert.deepEqual(
    normalizeAnnouncementInput({
      title: "  Jadwal   latihan  ",
      body: "\nIsi tetap plain text\n",
      external_url: " https://example.com/info ",
      pinned: true,
      expires_on: "2026-10-31",
    }),
    {
      title: "Jadwal latihan",
      body: "Isi tetap plain text",
      external_url: "https://example.com/info",
      pinned: true,
      expires_on: "2026-10-31",
    },
  );
  assert.throws(
    () =>
      normalizeAnnouncementInput({
        title: "",
        body: "Isi",
        external_url: "",
        pinned: false,
        expires_on: "",
      }),
    /Judul/,
  );
  assert.throws(
    () =>
      normalizeAnnouncementInput({
        title: "Judul",
        body: "x".repeat(5001),
        external_url: "",
        pinned: false,
        expires_on: "",
      }),
    /5\.000/,
  );
  assert.throws(
    () =>
      normalizeAnnouncementInput({
        title: "Judul",
        body: "Isi",
        external_url: "http://example.com",
        pinned: false,
        expires_on: "",
      }),
    /HTTPS/,
  );
  assert.equal(validCalendarDay("2028-02-29"), true);
  assert.equal(validCalendarDay("2026-02-29"), false);
});

test("expiry uses the Jakarta calendar-day boundary", () => {
  const item = announcement("day", { expires_on: "2026-10-03" });
  assert.equal(
    isAnnouncementActive(item, new Date("2026-10-03T16:59:59Z")),
    true,
  );
  assert.equal(
    isAnnouncementActive(item, new Date("2026-10-03T17:00:00Z")),
    false,
  );
  assert.equal(
    isAnnouncementActive(announcement("draft", { published_at: null })),
    false,
  );
  assert.equal(
    isAnnouncementActive(
      announcement("archive", { archived_at: "2026-10-02T00:00:00Z" }),
    ),
    false,
  );
});

test("active feed pins first, then newest, and Home is capped at three", () => {
  const items = [
    announcement("old", { published_at: "2026-10-01T00:00:00Z" }),
    announcement("new", { published_at: "2026-10-03T00:00:00Z" }),
    announcement("pin-old", {
      pinned: true,
      published_at: "2026-09-01T00:00:00Z",
    }),
    announcement("pin-new", {
      pinned: true,
      published_at: "2026-10-02T00:00:00Z",
    }),
    announcement("draft", { published_at: null }),
  ];
  assert.deepEqual(
    activeAnnouncements(items, new Date("2026-10-03T00:00:00Z")).map(
      (item) => item.id,
    ),
    ["pin-new", "pin-old", "new", "old"],
  );
  assert.deepEqual(
    homeAnnouncements(items, new Date("2026-10-03T00:00:00Z")).map(
      (item) => item.id,
    ),
    ["pin-new", "pin-old", "new"],
  );
});

test("management filters and summaries are deterministic", () => {
  assert.equal(announcementFilter(announcement("published")), "published");
  assert.equal(
    announcementFilter(announcement("draft", { published_at: null })),
    "draft",
  );
  assert.equal(
    announcementFilter(
      announcement("archived", { archived_at: "2026-10-03T00:00:00Z" }),
    ),
    "archived",
  );
  assert.equal(announcementSummary("A\n\nB", 20), "A B");
  assert.equal(announcementSummary("1234567890", 6), "12345…");
});

test("announcement UI uses guarded editor, offline loaders and no delete action", () => {
  const root = path.join(__dirname, "..");
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const screen = read("src/screens/AnnouncementScreens.tsx");
  const migration = read("supabase/migrations/202610030025_announcements.sql");
  assert.match(screen, /usePreventRemove\(dirty \|\| saving/);
  assert.match(screen, /church\.loadAnnouncements/);
  assert.match(screen, /church\.loadAnnouncement/);
  assert.match(screen, /Internet diperlukan/);
  assert.doesNotMatch(screen, /\.delete\(/);
  assert.match(migration, /grant update \([\s\S]*updated_by/);
  assert.doesNotMatch(migration, /grant delete/i);
});
