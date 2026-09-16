const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  jakartaDay,
  upcomingSunday,
  monthSundays,
  shiftMonth,
  weekLabel,
} = require("../.test-build/calendar.js");
const { youtubeId } = require("../.test-build/youtube.js");
const { homeMessage } = require("../.test-build/weekly.js");
test("Home distinguishes pending publication from no duty and admin missing-service actions", () => {
  assert.equal(
    homeMessage(false, false, 0),
    "Jadwal minggu ini belum diumumkan",
  );
  assert.equal(
    homeMessage(false, false, 1),
    "Jadwal minggu ini belum diumumkan",
  );
  assert.equal(homeMessage(false, true, 0), "Tidak ada tugas minggu ini");
  assert.equal(homeMessage(false, true, 1), null);
  assert.equal(homeMessage(true, false, 0), null); // admin renders both service/create shortcuts
});
test("Jakarta midnight crosses UTC day and Sunday counts as today", () => {
  assert.equal(jakartaDay(new Date("2026-09-19T17:00:00Z")), "2026-09-20");
  assert.equal(upcomingSunday(new Date("2026-09-19T17:00:00Z")), "2026-09-20");
  assert.equal(upcomingSunday(new Date("2026-09-20T16:59:59Z")), "2026-09-20");
  assert.equal(upcomingSunday(new Date("2026-09-20T17:00:00Z")), "2026-09-27");
});
test("upcoming Sunday crosses month and year boundaries", () => {
  assert.equal(upcomingSunday(new Date("2026-09-30T05:00:00Z")), "2026-10-04");
  assert.equal(upcomingSunday(new Date("2026-12-31T05:00:00Z")), "2027-01-03");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});
test("chronological fifth Sundays and leap-year February", () => {
  assert.deepEqual(monthSundays("2026-11"), [
    "2026-11-01",
    "2026-11-08",
    "2026-11-15",
    "2026-11-22",
    "2026-11-29",
  ]);
  assert.equal(weekLabel("2026-11-29"), "MINGGU 5");
  assert.deepEqual(monthSundays("2032-02"), [
    "2032-02-01",
    "2032-02-08",
    "2032-02-15",
    "2032-02-22",
    "2032-02-29",
  ]);
  assert.throws(() => monthSundays("2026-13"));
});
test("YouTube references accept supported URLs but reject spoofed hosts and schemes", () => {
  for (const url of [
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5",
    "https://youtube.com/embed/dQw4w9WgXcQ",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
  ])
    assert.equal(youtubeId(url), "dQw4w9WgXcQ");
  for (const url of [
    "javascript:alert(1)",
    "http://youtube.com/watch?v=dQw4w9WgXc",
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXc",
    "https://youtu.be/short",
    "garbage",
  ])
    assert.equal(youtubeId(url), null);
});
