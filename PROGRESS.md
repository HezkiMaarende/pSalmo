# pSalmo Progress Tracker

Last updated: 16 September 2026

| Milestone | Status | Exit criteria |
| --- | --- | --- |
| 0. Project foundation | In progress | Typecheck, domain tests, Android JavaScript export, and GitHub CI pass; device launch and native/Hermes validation remain |
| 1. Data and access | Implemented; device gate open | Guarded exact-email roster linking, membership revocation, permanent song-editor capability, roster-only publication projection, and role/RLS SQL tests pass; native session/device exercise remains |
| 2. Five-page weekly church workflow | Implemented; device gate open | Five tabs, drawer, Home/Jadwal, shared IR1/2, independent IR3, PIC roster/publication, service details/arrangements, and HTTP409 revision-safe reorder implemented; real Android flow remains |
| 3. Song Bank and Smart Add | In progress | Search, canonical lyrics/defaults, ordered video references, service snapshots, editor permissions, and profile editing implemented; Smart Add and medleys remain |
| 4. Offline and click device | Native audio spike implemented; device gate open | Latihan Edit/Play and native PCM-loop driver implemented; native/Hermes, route-safe/background behavior, offline prefetch and 30-minute hardware validation remain |
| 5. Pilot | Not started | One worship team uses it for real service preparation and issues are triaged |

## This iteration

### Phone feedback and next step

- [x] User reports trying the revised app on their phone and that it looks great. This confirms a user-reported launch/layout smoke test, not every permission, persistence, video, or native/Hermes acceptance check. Phone OS and runtime were not specified.
- [x] User confirmed Frozen Ape Tempo through its Android and iOS store links. See `docs/latihan-audio.md` for references, counting conventions and the bounded Edit/Play baseline.

### Latihan / native audio spike — 16 September

#### Move from Expo Go to native Android

- [x] User confirms their test is in Expo Go and Start is greyed out. This is the native-module capability gate, not an audible-playback result. Clarify the disabled-Start explanation.
- [x] Install SDK54-compatible `expo-dev-client`6.0.21 and `expo-system-ui`6.0.9. Generate the native Android project with Hermes and New Architecture enabled; keep generated folders and artifacts ignored.
- [x] Add explicit `start:dev`, `start:go`, `generate:android` and guarded `build:android` commands. The Windows script uses a short cache, isolated SDK preferences, in-process Kotlin compilation, explicit-device installation and USB forwarding; preserve existing account/ADB identities.
- [x] Add an idempotent Windows config-plugin override for the audio dependency's Bash downloader. Git Bash fails at signal-pipe creation here; PowerShell5's download also fails TLS. The Windows wrapper uses Node's verified HTTPS, the installed dependency's same official release tag and only Android archives; no audio-engine patch or TLS verification bypass. Download/extract `rn-audio-libs`v3.1.0 Android archive succeeds (SHA256 `5f6d01fc82cb736f00485f40d78735414494096a3a14be616c17666babbc046a`).
- [x] Connect and authorize the user's Samsung SM-A346E (Galaxy A34), Android16, arm64-v8a. No Expo Go tokens are copied into the new app.
- [x] Install missing NDK27.1.12297006, Android Build Tools36.0.0, Platform36 and CMake3.22.1 using existing accepted SDK licences. Config introspection confirms Hermes, New Architecture and FFmpeg-disabled flags. Audio API's Kotlin/Java compilation succeeds; C++/APK/launch gates are still open.
- [x] Add two Windows build-plugin tests (preservation/idempotency and unsupported-language rejection); total suite now14 tests. Node download script and both PowerShell scripts parse/check successfully.
- [x] Typecheck and all14 tests pass after the native-tooling changes. Android JavaScript export passes after dependency changes (994 modules,1.96MB). Script parses without PowerShell syntax errors.
- [ ] Complete native compilation and install the development APK. Short Gradle cache and isolated `ANDROID_USER_HOME` resolve earlier cache/SDK-discovery failures. The next build completes Java/Kotlin compilation but stalls in CMake's compiler-ABI check. A separate one-command Ninja task (`node --version`) stalls too with both SDK Ninja1.10.2 and official Ninja1.13.2; this points to the restricted Windows runner, not an app-specific C++ failure. Stop only this attempt's processes and preserve SDK/downloads/build caches. The later daemon-disappeared error is from deliberately stopping the stalled build, not evidence of a spontaneous crash. No APK, installation, native/Hermes runtime or sound success is claimed. Next action: user retries the updated short-copy build script in their own PowerShell window, reusing the existing short Gradle cache.
- [x] Diagnose the user's subsequent1m47s terminal failure from its saved Gradle log: `:app:buildCMakeDebug[arm64-v8a]` reports AsyncStorage's generated C++ filename exceeds260 characters; ExpoModulesCore also reaches a100-try CMake regeneration loop. Update the script to build a fresh short physical copy under TEMP (never move/mirror/delete the repository or reuse copied absolute-path CMake output), install locked dependencies with the existing npm cache, and copy only a successful APK back to original `artifacts/`. Preparation-only integration succeeds:760 packages installed in23s; prebuild finishes; source/temporary `.env` and lockfile hashes match; Git and old CMake caches are absent; Windows plugin marker appears once; Hermes/New Architecture remain enabled. The failing source path is reduced from265 to218 characters. Typecheck and all14 tests pass. Full C++/APK/install/audio verification remains pending the user-terminal retry.
- [ ] Launch the installed app through Metro, sign in, and exercise audible Start/Stop/Next. APK existence alone does not verify playback, timing or route safety.
- [x] Publish native-build tooling to GitHub `main` as [8b6094f](https://github.com/HezkiMaarende/pSalmo/commit/8b6094fc78da797ea13133767980b56481352427), verify exact remote/local tree `012b8b39213e4e8640298f88f78c56cefbddc5e9`, and confirm [CI run35112594510](https://github.com/HezkiMaarende/pSalmo/actions/runs/35112594510) succeeds. CI covers npm ci, TypeScript, all14 tests and Android JavaScript export, not native C++ compilation or audible playback. Existing user Metro8081 is preserved; a separate development-client Metro8082 is running for the user-terminal build/install handoff. No paid cloud build or store upload is started.

- [x] Add a fresh-RLS-loaded Latihan route from Ibadah. Play has song information, beat indicators, saved notes/structure, Start/Stop and non-autostarting Next; Edit is available only to authorized service editors.
- [x] Edit/tap BPM, birama and notes with guarded save and unsaved-change confirmation before song/mode switching. Updates preserve key, lyrics, structure, references and canonical Song Bank. No schema migration is required; existing arrangement columns and tested RLS apply.
- [x] Pin `react-native-audio-api` 0.12.2 (official compatibility table supports RN0.81); gate/lazily load native playback so Expo Go remains usable for settings/notes with Start disabled and a clear development-build explanation.
- [x] Generate an accented, >=30-second complete-bar PCM loop using absolute sample positions; native looping schedules sound, not a JS timer. The display reads the audio clock. Support integer BPM20–400, 1–13 denominator-note pulses, denominators2/4/8/16; require valid saved settings rather than silently defaulting.
- [x] Cancel late pending starts, serialize competing activation, stop on Next/blur/unmount/refresh/inactive/background and reported interruptions/duck/route changes; never resume automatically. This is foreground-only, not the final background/lock-screen objective.
- [x] TypeScript and **12 tests** pass: calendar/visibility/video plus supported-tempo/meter sample math, nominal rounding drift (<4ms over 30 minutes), PCM accent/silence, beat-loop alignment, tap tempo and cancellation/competing-start/failure recovery. Mathematical bounds are not measured device timing.
- [x] Extend and run rollback-only authenticated-role tests against live Supabase: assigned WL editor saves click settings; ordinary/off-duty/kicked users cannot; arrangement columns and Song Bank stay independent. Full prior workflow regression passes; synthetic fixtures roll back.
- [x] Android JavaScript export passes with `--no-bytecode --max-workers 1` (994 modules, 1.95MB). `npm ci --dry-run --ignore-scripts` resolves the lockfile without legacy-peer flags. Expo config introspection completes and shows unused FFmpeg disabled, no audio background modes or foreground-service permissions added.
- [x] Publish the iteration to GitHub `main` as [6bba588](https://github.com/HezkiMaarende/pSalmo/commit/6bba588444f1c10363feed7bbdd1bc983f6adb35), verify remote/local exact tree `00b977498a1a4c65e630c37143bf8074e028ceff`, and confirm [CI run35087920684](https://github.com/HezkiMaarende/pSalmo/actions/runs/35087920684) succeeds (npm ci, typecheck,12 tests, Android JavaScript export). Command-line Git still fails with Windows TLS credential errors; the connected GitHub API performed a non-force fast-forward and local refs were reconciled without file resets.
- [ ] Build/launch native Android with Hermes and exercise actual audible Start/Stop/Next and persisted Edit settings. Normal Hermes export was retried and still fails at Windows `spawn EPERM`; native playback is not verified.
- [ ] Implement and test native Android route-disconnect safety: inspected audio-library Android source does not emit `routeChange`. Do not rely on the listener for IEM disconnect/speaker fallback. iOS listener behavior also needs device testing.
- [ ] Measure actual Start latency/memory, silent-mode/interruption behavior and 30-minute wired/USB audio-clock timing. Extend to reliable background/lock-screen playback only with explicit native lifecycle/route handling. Not live-service-ready.
- [ ] Review dependency advisories before pilot: `npm audit --omit=dev` reports 16 (7 moderate,9 high) in the existing Expo/build-tool dependency graph; audio package itself is not flagged. No forced SDK upgrade was applied during this audio spike.

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
- [x] Install dependencies; user reports the revised app runs on their phone. Full device acceptance remains outstanding above.
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
- No agent-run on-device sign-in or service flow has been exercised. The subsequent user-reported phone launch/layout smoke test is recorded above; detailed workflow and native/Hermes results are not yet established.
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
3. **Audio validation next:** Frozen Ape Tempo reference confirmed; Latihan Edit/Play foreground-only spike is implemented. Build/launch native/Hermes, implement Android route safety, confirm actual phone/mixer/IEM chain, and measure audio-clock timing before background/lock playback or live use. Custom accents, dotted beats, subdivisions/count-in and other Tempo extras wait for rehearsal feedback.
4. **Smart Add:** decide provider/consent and de-identified fixtures; implement review-gated WhatsApp extraction/matching without silently creating library songs. Carry encrypted expiring job requirements forward.
5. **Medleys and licensing:** medley grouping remains deferred; confirm lyrics licensing/attribution and CCLI before wider rollout (attribution fields exist but do not establish a licence).
6. **Offline and pilot:** upcoming-service prefetch/read-only offline mode, actual background/hardware reliability testing, then a real team pilot.
