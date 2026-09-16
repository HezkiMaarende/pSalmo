# pSalmo Progress Tracker

Last updated: 16 September 2026

| Milestone | Status | Exit criteria |
| --- | --- | --- |
| 0. Project foundation | In progress | Typecheck and Android JavaScript export pass; device launch, Hermes build, and CI baseline remain |
| 1. Data and access | In progress | Schema, RLS hardening, assignment policy, and encrypted native session storage added; multi-user policy tests remain |
| 2. Weekly service workspace | In progress | Auth, team/service setup, admin roster/notes/media/setlist editing, and atomic setlist reorder added; lifecycle, medleys, and device testing remain |
| 3. Song Bank and Smart Add | In progress | Canonical Song Bank creation and setlist selection added; matching, review/commit, provider abstraction, and expiring encrypted jobs remain |
| 4. Offline and click device | Not started | Upcoming service prefetch, read-only offline mode, 30-minute hardware validation |
| 5. Pilot | Not started | One worship team uses it for real service preparation and issues are triaged |

## This iteration

- [x] Clone and initialize the `pSalmo` repository.
- [x] Review the exported technical design, including its V1 Scope Amendment.
- [x] Establish Expo/TypeScript application foundation.
- [x] Draft the Supabase schema, indexes, service-role separation, and RLS policies.
- [x] Add public-environment configuration and a typed Supabase client scaffold.
- [x] Apply the initial schema to Supabase project `uhyxiflkahqqutnkvash` and confirm all 14 application tables exist.
- [x] Apply the private-helper hardening migration and rerun the Security Advisor (0 errors, 0 warnings).
- [x] Add email sign-in/sign-up and native encrypted session persistence.
- [x] Add team and service creation/selection, plus read-only roster, setlist, notes, and media display.
- [x] Apply `202609160002_assignment_permissions.sql` to restrict assignment changes to team admins; SQL Editor reported success.
- [x] Add admin controls for temporary roster roles, shared notes, media references, and proposed-title setlist items.
- [x] Add and apply `202609160003_setlist_reorder.sql` for atomic adjacent setlist reordering; rerun Security Advisor (0 errors, 0 warnings).
- [x] Fix first-team creation under RLS with the `create_team` RPC; verified as the signed-in test user in a rolled-back transaction.
- [x] Add a team-scoped Song Bank with canonical title, artist, default key, and BPM, plus canonical-song selection for service setlists.
- [x] Add service-specific setlist arrangement editing for key, BPM, time signature, structure, lyrics/chords, arrangement link, and notes.
- [x] Add bulk service-only setlist proposals with blank-line and duplicate filtering.
- [ ] Install dependencies and run the starter on a device/simulator.
- [ ] Run cross-team and role-specific policy tests using separate authenticated users.
- [ ] Settle the remaining open product decisions below before their related features.

## Verification notes

- TypeScript check passed on 16 September 2026.
- Android JavaScript export passed with `--no-bytecode --max-workers 1`. A normal export reached Hermes bytecode generation but failed with Windows `spawn EPERM`; a native/Hermes build is not yet verified.
- Web export stopped at `fetch failed` before bundling; no web-bundle result is claimed.
- No on-device sign-in or service flow has been exercised yet.
- Workspace mutations are compiled and backed by RLS; they still need an on-device and separate-user exercise.
- Song Bank changes passed TypeScript and Android JavaScript-export checks; a real team/service exercise remains.

## Decisions captured from the design

- The V1 Scope Amendment is authoritative over prior conflicting sections.
- Permission roles: `owner`, `admin`, `member`; temporary service roles are separate.
- Smart Add only creates reviewable candidates. It cannot silently create canonical songs.
- Chords and arrangements belong to a `SetlistItem`; the Song Bank owns canonical metadata.
- Store structure as structured JSON with nullable bar counts.
- Smart Add input is encrypted, kept for 30 days, then deleted; jobs are one-time and expiring.
- Supabase RLS is the primary data-access boundary; service-role credentials never reach the client.

## Decisions needed before implementation

- [ ] Confirm whether members can edit anything, or are strictly read-only (current UI treats members as read-only).
- [ ] Confirm the church's CCLI licence status and required per-song attribution fields.
- [ ] Choose and benchmark the Smart Add provider using de-identified Indonesian fixture messages.
- [ ] Define Service lifecycle: draft, approved, archived/cancelled.
- [ ] Confirm the supported Android/iOS phones/tablets and church mixer/IEM chain for click-device testing.

## Key acceptance gates

- Cross-team reads and writes are blocked by tested RLS policies.
- Smart Add preview writes no setlist content; only reviewed, confirmed candidates commit.
- Upcoming service content opens read-only without a network connection.
- Click device runs for 30 minutes through wired/USB output with typical click-to-click error <=5 ms and cumulative drift <=20 ms against the audio clock, including lock/background and audio-route interruption behaviour.
