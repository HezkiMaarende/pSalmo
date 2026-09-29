const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const {
  OFFLINE_VALID_MS,
  cachedSchedule,
  cachedServices,
  canUseOfflineSnapshot,
  eligibleOfflineService,
  nextFourSundays,
  offlineExpiry,
  openOfflineSnapshot,
  sanitizeOfflineDetail,
  sealOfflineSnapshot,
  shouldRefreshOffline,
} = require("../.test-build/offline.js");

function service(id, day = "2026-09-27") {
  return {
    id,
    team_id: "church",
    title: id,
    service_type: "ir_1_2",
    service_date: `${day}T00:00:00+07:00`,
    service_day: day,
    status: "approved",
  };
}

function snapshot(overrides = {}) {
  return {
    version: 1,
    userId: "user-a",
    teamId: "church",
    membership: { role: "member", song_editor: false },
    name: "A",
    verifiedAt: "2026-09-27T00:00:00.000Z",
    syncedAt: "2026-09-27T00:00:00.000Z",
    sundays: ["2026-09-27", "2026-10-04", "2026-10-11", "2026-10-18"],
    weeks: [
      {
        sunday: "2026-09-27",
        published_at: "2026-09-26T00:00:00Z",
        services: [],
      },
      { sunday: "2026-10-04", published_at: null, services: [] },
    ],
    services: [service("one"), service("two", "2026-10-04")],
    details: {},
    ...overrides,
  };
}

test("Sunday counts as the first of exactly four cached Sundays", () => {
  assert.deepEqual(nextFourSundays(new Date("2026-09-27T03:00:00Z")), [
    "2026-09-27",
    "2026-10-04",
    "2026-10-11",
    "2026-10-18",
  ]);
});

test("offline identity and seven-day membership boundary are enforced", () => {
  const value = snapshot();
  assert.equal(
    canUseOfflineSnapshot(
      value,
      "user-a",
      "church",
      new Date(value.verifiedAt),
    ),
    true,
  );
  assert.equal(
    canUseOfflineSnapshot(
      value,
      "user-a",
      "church",
      new Date(new Date(value.verifiedAt).getTime() + OFFLINE_VALID_MS),
    ),
    true,
  );
  assert.equal(
    canUseOfflineSnapshot(
      value,
      "user-a",
      "church",
      new Date(new Date(value.verifiedAt).getTime() + OFFLINE_VALID_MS + 1),
    ),
    false,
  );
  assert.equal(canUseOfflineSnapshot(value, "user-b", "church"), false);
  assert.equal(canUseOfflineSnapshot(value, "user-a", "other"), false);
  assert.equal(offlineExpiry(value), "2026-10-04T00:00:00.000Z");
});

test("encrypted snapshot round-trips and rejects tampering or the wrong key", () => {
  const value = snapshot();
  const key = "11".repeat(32);
  const payload = sealOfflineSnapshot(value, key, new Uint8Array(12).fill(7));
  assert.deepEqual(openOfflineSnapshot(payload, key), value);
  const last = payload.endsWith("0") ? "1" : "0";
  assert.throws(() => openOfflineSnapshot(payload.slice(0, -1) + last, key));
  assert.throws(() => openOfflineSnapshot(payload, "22".repeat(32)));
});

test("offline detail is read-only and contains no account-link identifiers", () => {
  const detail = {
    service: service("one"),
    revision: 4,
    items: [],
    can_edit: true,
    assignments: [
      {
        id: "a",
        role_name: "WL",
        display_name: "Nama",
        person_id: "private-person",
        user_id: "private-user",
      },
    ],
    notes: [{ id: "n", body: "note" }],
    media: [],
  };
  const clean = sanitizeOfflineDetail(detail);
  assert.equal(clean.can_edit, false);
  assert.equal(clean.assignments[0].person_id, null);
  assert.equal(clean.assignments[0].user_id, null);
  assert.equal(clean.assignments[0].display_name, "Nama");
});

test("cache queries cannot return data outside the requested range", () => {
  const value = snapshot();
  assert.deepEqual(
    cachedSchedule(value, "2026-10-04", "2026-10-04").map((x) => x.sunday),
    ["2026-10-04"],
  );
  assert.deepEqual(
    cachedServices(value, "2026-09-27", "2026-09-27").map((x) => x.id),
    ["one"],
  );
  assert.equal(
    shouldRefreshOffline(value, new Date("2026-09-27T00:14:59Z")),
    false,
  );
  assert.equal(
    shouldRefreshOffline(value, new Date("2026-09-27T00:15:00Z")),
    true,
  );
});

test("cancelled and archived services are never eligible for cache", () => {
  assert.equal(eligibleOfflineService({ status: "draft" }), true);
  assert.equal(eligibleOfflineService({ status: "approved" }), true);
  assert.equal(eligibleOfflineService({ status: "archived" }), false);
  assert.equal(eligibleOfflineService({ status: "cancelled" }), false);
});

test("offline UI uses centralized loaders and centralized sign-out", () => {
  const root = path.join(__dirname, "..");
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const weekly = read("src/screens/WeeklyScreens.tsx");
  const serviceScreen = read("src/screens/ServiceScreens.tsx");
  const profile = read("src/screens/ProfileScreen.tsx");
  const app = read("App.tsx");
  assert.match(weekly, /church\.loadSchedule/);
  assert.match(weekly, /church\.loadServices/);
  assert.match(serviceScreen, /church\.loadServiceDetail/);
  assert.match(
    serviceScreen,
    /Practice dan audio baru tidak tersedia saat offline/,
  );
  assert.match(profile, /church\.signOut/);
  assert.match(app, /church\.signOut/);
  assert.doesNotMatch(profile, /supabase\.auth\.signOut/);
  assert.doesNotMatch(app, /supabase\.auth\.signOut/);
});
