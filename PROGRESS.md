# pSalmo Progress Tracker

Last updated: 16 September 2026

| Milestone | Status | Exit criteria |
| --- | --- | --- |
| 0. Project foundation | In progress | Typecheck, domain tests, Android JavaScript export, and GitHub CI pass; device launch and native/Hermes validation remain |
| 1. Data and access | Implemented; device gate open | Guarded exact-email roster linking, membership revocation, permanent song-editor capability, roster-only publication projection, and role/RLS SQL tests pass; native session/device exercise remains |
| 2. Five-page weekly church workflow | Implemented; device gate open | Five tabs, drawer, Home/Jadwal, shared IR1/2, independent IR3, PIC roster/publication, service details/arrangements, and HTTP409 revision-safe reorder implemented; real Android flow remains |
| 3. Song Bank and Smart Add | In progress | Search, canonical lyrics/defaults, ordered video references, service snapshots, editor permissions, and profile editing implemented; Smart Add and medleys remain |
| 4. Offline and click device | Not started | Upcoming service prefetch, read-only offline mode, 30-minute hardware validation |
| 5. Pilot | Not started | One worship team uses it for real service preparation and issues are triaged |

## This iteration

### Approved five-page objective — 16 September

- [x] Create clean GPdI Elshaddai Magelang workspace with the existing owner. Verify 0 services, 0 roster people, and 0 songs; preserve `sounday` (its existing service remains).
- [x] Configure generated workspace ID in ignored `.env`, not application source; add environment template and bootstrap SQL.
- [x] Apply migrations `202609160009` through `202609160017` to the selected Supabase project.
- [x] Add roster people, guarded exact-email linking, add/kick controls, and permanent `song_editor` capability. Remove invite/team-switching UI and disable invite creation/acceptance for admin-managed churches; preserve/test prototype invitation path.
- [x] Close the old NULL-caller-role membership RPC bypass. Reject foreign church people and songs, including direct item linkage validation.
- [x] Add separately published weekly schedules and an authenticated roster-only projection without setlists, notes, media, or account identifiers.
- [x] Split authentication, context, navigation, pages, shared UI, calendar logic, and data access out of single-screen App.tsx. Add five bottom tabs, detail/edit stacks, closing overlay drawer, and admin management screens.
- [x] Implement Jakarta upcoming-Sunday Home, published/no-duty states, monthly Sundays/Minggu1–5, shared IR1/2 roster sections, and independent IR3.
- [x] Implement collapsed Petugas, ordered songs, expanded lyrics, lazy/no-autoplay YouTube with application referrer and external fallback, manual/Song Bank additions, service-specific arrangements, and PIC notes/media/approval.
- [x] Implement searchable Song Bank, sectioned plain lyrics, defaults, attribution, ordered labeled videos, and eligible service targets. Snapshot title/artist/defaults/lyrics/all video references so later library changes leave existing services unchanged.
- [x] Add profile-name editing/greeting refresh, account details, sign-out, and empty Pengumuman/Peraturan pages. Label actual Latihan/audio playback as deferred, not working.
- [x] Test rolled-back synthetic authenticated owner/member/editor/outsider roles against live RLS/RPCs. Linking, unregistered-email rejection, guest labels, actual MD without editor permission, off-duty library permission, unrelated-service denial, draft/approved access, publication projection, cross-church references, preserved kick history, and prototype invitation behavior pass.
- [x] Test simultaneous authenticated reorder requests through the actual API using a disposable account/workspace: one accepted, one **HTTP409/PT409** conflict, complete unique ordering. Remove that disposable account/workspace and verify 0 remaining test accounts.
- [x] `npm run typecheck`, `npm test` (5 tests), and final Android JavaScript export (`--no-bytecode --max-workers 1`) pass.
- [x] Add GitHub Actions checks for typecheck, domain tests, and Android JavaScript export. [Implementation CI run](https://github.com/HezkiMaarende/pSalmo/actions/runs/35085709952) completed successfully for `a7cd2d6`.
- [x] Publish the implementation to GitHub `main` as [a7cd2d6](https://github.com/HezkiMaarende/pSalmo/commit/a7cd2d648be9aafdd1c27222b6a67bcbc9219857) and verify its exact file-tree hash against the locally tested build.
- [ ] Complete the real Android navigation/auth/roster/library/video/profile checklist in `docs/device-validation.md`.
- [ ] Build/launch native Android with Hermes and test encrypted session storage/activity restoration. JavaScript export does not close this gate.
- [ ] Review/enable leaked-password protection in Supabase Auth if available for this project's plan; settings were not changed here.

Implementation is ready for device acceptance, **not** declared pilot-ready. Earlier entries below describe historical prototype progress and are superseded where the approved five-page plan differs.

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
- [x] Add and apply expiring single-use invites, invite revocation, guarded membership role/removal RPCs, and approved-service visibility rules.
- [x] Distinguish PIC/admin workspace management from temporary WL/MD setlist editing in the app UI and RLS policies.
- [ ] Install dependencies and run the starter on a device/simulator.
- [x] Run cross-team and role-specific policy checks as synthetic authenticated identities, plus a real authenticated API reorder race. Separate-person device sessions remain in the acceptance checklist.
- [ ] Settle the remaining open product decisions below before their related features.

## Verification notes

- Final five-page TypeScript and 5 pure-domain tests passed on 16 September. Tests cover Jakarta Sunday/midnight, month/year boundaries, fifth Sundays/leap February, Home state distinctions, and safe YouTube URL parsing.
- Final Android JavaScript export passed: 919 modules, 1.86MB source bundle. No native/Hermes or real Android UI success is claimed.
- Database policy/workflow fixtures are transactionally rolled back. The separately committed disposable API race fixture was explicitly deleted and its account/session records removed. No prototype or real church content was deleted.
- Reorder now uses the private authorization helper, locks the setlist, requires an expected revision, swaps atomically, and increments revision through item mutation triggers. Revision is monotonic (a swap has three row writes), not guaranteed to increase by exactly one.
- The first role test caught a service-row lock requiring PIC update permission; an advisory lock now serializes initial append while retaining invoker/RLS and the editable-setlist parent lock. The actual API race exposed SQLSTATE40001's HTTP500 mapping; optimistic conflicts now use PT409/HTTP409, tested concurrently.
- Security Advisor: no error-level findings; one grouped warning lists 10 intentionally authenticated-only guarded SECURITY DEFINER RPCs, and one warning reports leaked-password protection disabled. See [RPC notice remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [Auth password-protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Signed-in RPC notice is not a substitute for role tests; those tests are recorded above.
- RLS revokes future access immediately after membership removal. Data already downloaded to a device cannot be remotely recalled; screens discard blurred loads and refetch on opening, and foreground membership refresh removes church screens if access is gone.
- Windows command-line Git hit DNS/TLS credential errors. The connected GitHub API published one coherent fast-forward commit with the exact verified tree. Local `main` and `origin/main` were reconciled to that verified commit without changing files; the original task commit remains recoverable in `backup/five-page-local-a277757`.

- TypeScript check passed on 16 September 2026.
- Android JavaScript export passed with `--no-bytecode --max-workers 1`. A normal export reached Hermes bytecode generation but failed with Windows `spawn EPERM`; a native/Hermes build is not yet verified.
- Web export stopped at `fetch failed` before bundling; no web-bundle result is claimed.
- No on-device sign-in or service flow has been exercised yet.
- Workspace mutations are compiled and backed by RLS; they still need an on-device and separate-user exercise.
- Song Bank changes passed TypeScript and Android JavaScript-export checks; a real team/service exercise remains.
- Access and publication changes passed TypeScript and Android JavaScript-export checks. The Supabase Security Advisor confirms the access RPCs are not anonymous; its signed-in `SECURITY DEFINER` notices are expected because the guarded RPCs are the only supported membership-write path.

## Decisions captured from the design

- The V1 Scope Amendment is authoritative over prior conflicting sections.
- Permission roles: `owner`, `admin`, `member`; temporary service roles are separate.
- Smart Add only creates reviewable candidates. It cannot silently create canonical songs.
- Chords and arrangements belong to a `SetlistItem`; the Song Bank owns canonical metadata.
- Store structure as structured JSON with nullable bar counts.
- Smart Add input is encrypted, kept for 30 days, then deleted; jobs are one-time and expiring.
- Supabase RLS is the primary data-access boundary; service-role credentials never reach the client.

## Decisions needed before implementation

- [ ] Confirm the church's CCLI licence status and required per-song attribution fields.
- [ ] Choose and benchmark the Smart Add provider using de-identified Indonesian fixture messages.
- [x] Service lifecycle: draft, approved, archived/cancelled; PIC-only lifecycle changes, schedule publication independent of song approval.
- [ ] Confirm the supported Android/iOS phones/tablets and church mixer/IEM chain for click-device testing.

## Key acceptance gates

- Cross-team reads and writes are blocked by tested RLS policies.
- Ordinary members cannot open draft services. Permanently authorized, linked WL/MD users can prepare their assigned drafts and edit only those setlists; PIC/admin retains roster and approval/publication control.
- Smart Add preview writes no setlist content; only reviewed, confirmed candidates commit.
- Upcoming service content opens read-only without a network connection.
- Click device runs for 30 minutes through wired/USB output with typical click-to-click error <=5 ms and cumulative drift <=20 ms against the audio clock, including lock/background and audio-route interruption behaviour.

## Next objectives and carried research

1. **Device acceptance first:** use `docs/device-validation.md`, verify native/Hermes, then triage actual church preparation feedback.
2. **Roster import research:** confirm the church's real CSV columns, role names, family/group entries, multiple names per role, account matching, and how schedules are approved. Manual entry stays the first implementation; do not invent/import a CSV format yet.
3. **Audio discovery:** confirm the exact Tempo app and desired controls before implementing Latihan with separate Edit/Play modes. Establish native audio-clock/output-route behavior and actual mixer/IEM test devices.
4. **Smart Add:** decide provider/consent and de-identified fixtures; implement review-gated WhatsApp extraction/matching without silently creating library songs. Carry encrypted expiring job requirements forward.
5. **Medleys and licensing:** medley grouping remains deferred; confirm lyrics licensing/attribution and CCLI before wider rollout (attribution fields exist but do not establish a licence).
6. **Offline and pilot:** upcoming-service prefetch/read-only offline mode, actual background/hardware reliability testing, then a real team pilot.
