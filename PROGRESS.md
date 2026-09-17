# pSalmo Progress Tracker

Last updated: 17 September 2026

| Milestone | Status | Exit criteria |
| --- | --- | --- |
| 0. Project foundation | In progress | Typecheck, tests, Android JavaScript export, CI and native Android APK compilation pass; native launch/clicks user-confirmed; detailed runtime/Hermes and device acceptance remain |
| 1. Data and access | Implemented; device gate open | Guarded exact-email roster linking, membership revocation, permanent song-editor capability, roster-only publication projection, and role/RLS SQL tests pass; native session/device exercise remains |
| 2. Five-page weekly church workflow | Implemented; device gate open | Five tabs, drawer, Home/Jadwal, shared IR1/2, independent IR3, PIC roster/publication, service details/arrangements, and HTTP409 revision-safe reorder implemented; real Android flow remains |
| 3. Song Bank and Smart Add | In progress | Search, canonical lyrics/defaults, ordered video references, service snapshots, editor permissions, and profile editing implemented; Smart Add and medleys remain |
| 4. Offline and click device | Native audio spike implemented; device gate open | Latihan Edit/Play and native PCM-loop driver implemented; native/Hermes, route-safe/background behavior, offline prefetch and 30-minute hardware validation remain |
| 5. Pilot | Not started | One worship team uses it for real service preparation and issues are triaged |

## This iteration

### Setlist is the edit page — 17 September

- [x] Add the requested meter popup instead of free typing: 36 options, numerator1–12 and denominators2/4/8, from1/2 to12/8. Reuse the selector in Setlist, service arrangements and Song Bank. Highlight the current value; selection closes the popup; Cancel/Android Back/backdrop do not modify it. Preserve old13-beat/16th meters unless explicitly replaced, with a visible explanation; optional library/arrangement values can be explicitly cleared.
- [x] Apply the user's correction: one controlled Setlist/Practice view, with no separate Edit tab or mode. Setlist includes the selected song's inline BPM/birama/notes editor for authorized PIC/admin or assigned WL/MD editors; ordinary users see read-only content. Add is available on Setlist only; Practice contains no editor or add controls.
- [x] Practice owns the circular playback dock. Entering editable Setlist stops playback; switching ordinary read-only views does not. Unsaved Setlist changes prompt before Practice, another song or Add; all switches/add actions disable during saving. Preserve app-wide/background playback and the global bottom mini-player.
- [x] Update the service entry label, navigation title and saved-settings explanation to Setlist/Practice. TypeScript, **30 tests**, and Android JavaScript export (`--no-bytecode --max-workers 1`,997 modules,1.97MB) pass; component-contract tests exercise merged editing, Practice isolation, disabled switches during saving, popup selection/cancellation/legacy values and all36 playable options. No native dependencies/config changes or APK rebuild required.
- [x] Publish both revisions as [dc6eb0e](https://github.com/HezkiMaarende/pSalmo/commit/dc6eb0eff809f8e5d7bb71a15f3d1d6d6212dead), verify exact tested tree `c92746361295caa81487a3cca46c2d0865a02da0`, and reconcile local/origin refs without resets. [CI run35185966697](https://github.com/HezkiMaarende/pSalmo/actions/runs/35185966697) succeeds (npm ci, TypeScript,30 tests, Android JavaScript export).
- [ ] Verify inline editing, save/discard prompts, Add, Practice dock, ordinary-member read-only behavior, and popup scrolling/selection/Cancel/Android Back on the phone. Native/Hermes, measured audio timing and route/background device gates remain explicitly outstanding.

### Tempo-inspired Latihan console — 17 September

- [x] User reports completing the rebuilt-app installation and liking the global bottom metronome panel. The background-configured APK's SHA256 was independently verified as `1ae1d75609f544416254bf5bc1d6784999b7880e7bcce756e670f0e8232e1553` (68,664,165 bytes); full lock-screen/interruption/Hermes acceptance still requires explicit exercise.
- [x] Adapt the supplied Tempo descriptions into a dark/orange Latihan console: METRONOME toolbar, view toggle/info, glowing meter-aware pulse lights, actual click/song status, service-titled selectable setlist with BPM/birama, and focused Practice view with notes/structure. View changes do not stop playback.
- [x] Anchor circular dark-gray Previous / Play–Stop / Next controls outside the scrolling content. Stop remains available during activation; previous/final boundaries are disabled; song changes stop without automatic start. Preserve the existing global mini-player unchanged.
- [x] Preserve authorized Edit/tap-tempo/save/dirty-change behavior; authorized Add opens the existing ibadah song workflow after stopping audio. No editor controls are exposed to ordinary members. Keep Automator/Tracker/mute out of the functional toolbar rather than showing fake counters/buttons; these remain deferred features.
- [x] TypeScript, all **25 tests**, and Android JavaScript export (`--no-bytecode --max-workers 1`,996 modules,1.97MB) pass. Four new mocked component-contract tests cover non-stopping view switching, actual meter lights, dock placement/track boundaries, pending Stop/Expo Go gating, and permission/Edit controls. These do not replace device rendering/touch checks.
- [x] Publish the console as [b2e3b9e](https://github.com/HezkiMaarende/pSalmo/commit/b2e3b9ef645e94b7369bce07f3a9a810bd2defed), verify exact tested tree `468fdc6bf1bae0e6e506117bf3d8f26b2770c8e1`, and reconcile local/origin refs without resets. [CI run35184902366](https://github.com/HezkiMaarende/pSalmo/actions/runs/35184902366) succeeds (npm ci, TypeScript,25 tests, Android JavaScript export).
- [ ] Reload the installed development app through Metro (no native dependency/config change or APK rebuild needed), inspect Setlist/Practice, long song titles/font scaling, orange pulse visibility, previous/final boundaries, dirty Edit guards and both Stop controls on the phone. Native timing, route safety and complete background checks remain open.

### Background click revision — 17 September

- [x] Replace screen-owned transport with one authenticated app-wide player. Tab/back navigation, switching apps, and screen lock no longer stop the native PCM loop. A global Stop bar remains visible outside navigation; display-only timers pause offscreen/background.
- [x] Enable Android media-playback foreground service, notification permission, and iOS audio background mode. Show labeled media controls before requesting audio focus; notification Stop/Pause/dismiss stops without automatic resume. No microphone permission added. Expo Go remains settings-only.
- [x] Recheck current service access through RLS on every Start and foreground return; stop on account change, membership loss, inaccessible service, explicit Stop/Next/Edit, or reported audio interruption. Already-downloaded audio cannot detect a remote kick while completely offline/backgrounded.
- [x] Serialize asynchronous notification/context disposal before replacement playback; cancel pending notification setup safely so late completion cannot resurrect audio or leave controls behind.
- [x] TypeScript, all **21 tests**, and Android JavaScript export (`--no-bytecode --max-workers 1`,995 modules,1.96MB) pass. New mocked-native tests cover loop ownership in background, notification Stop, cancellation during notification setup and permission denial; transport tests cover asynchronous disposal and cancellation. Expo introspection confirms mediaPlayback service, three required Android permissions, iOS `audio` background mode, and no microphone permission. These are not real-device background/Hermes acceptance tests.
- [ ] Rebuild/install the APK with the new manifest, then verify tab/back, other apps, screen lock for at least five minutes, lock-screen Stop, denied notification permission, rapid replacement, sign-out and interruptions on the Galaxy A34. The earlier audible APK does not contain these native background settings. No background/device acceptance success is claimed yet.
- [x] User confirms “closed” means **background and screen lock only**. Recents/process termination and force-stop survival are outside the requested scope; upstream service retains `stopWithTask=true`. No automatic restart after termination is implemented.
- [x] Publish background-click implementation as [8b4a777](https://github.com/HezkiMaarende/pSalmo/commit/8b4a77751ac401d0a81ec660f618290d964ad5e3); verify exact Git tree `4b0288abcb6ac22f9aff3189da990af8e620e8e4` and reconcile local/origin refs without resetting files. [CI run35183328014](https://github.com/HezkiMaarende/pSalmo/actions/runs/35183328014) succeeds (npm ci, TypeScript,21 tests, Android JavaScript export); no native APK build is performed for this revision.

### Native Android success and device acceptance — 17 September

- [x] Confirm the final user-terminal build from the saved Gradle log: `BUILD SUCCESSFUL in 2m20s`,396 tasks (193 executed,203 from cache). Development APK exists at ignored `artifacts/psalmo-development-arm64-v8a.apk`,68,663,873 bytes, SHA256 `d8a38868df048534a0713f491012824f2dc245ae155abefc93d7b47cbde87c69`. This verifies native compilation, including the audio module; no binary is published to GitHub.
- [x] User explicitly confirms hearing metronome clicks. Reconnected Galaxy A34 is authorized; package-manager query confirms `com.paw.psalmo` installed. USB forwarding and a cold native-activity launch succeed; Metro development server is restarted on8082. No account/token copying or automatic audio Start is performed.
- [ ] Complete the native transport/lifecycle pass with the revised behavior above: configured song Start/Stop; Next stops without auto-start; tab/back and screen lock/background retain playback; explicit Stop/interruption never auto-resumes; saved Edit settings persist after reopening. User-reported clicks are not proof of all controls or interruption handling.
- [ ] Independently verify actual Hermes runtime, sample rate, Start latency/memory and30-minute recorded timing. Hermes-enabled compilation and audible clicks alone do not establish the timing gate.
- [ ] Implement and hardware-test native Android route-disconnect safety before wired/USB/IEM use. Current0.12.2 Android library does not emit route changes. Ask which output the user tested (speaker, wired, Bluetooth or USB), and verify the real church audio chain before designing safe output controls. Background/lock-screen implementation is now in progress under the user-requested revision; hardware verification remains outstanding.

The successful build and audible feedback above supersede the earlier build-pending notes below. Those notes preserve the troubleshooting history, not the current build status.

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
- [x] Diagnose the next user-terminal4m33s failure (297 tasks executed,70 from cache): only Audio API's CMake build fails, with a nested `mkdir ... No such file or directory` and CMake's184-character object-directory-base warning. Add a Windows-only, module-specific Android Components `finalizeDsl` override moving Audio API CMake staging to the short root's `.cxx/a`; standard CMake object-path hashing now has a shorter base. Do not patch the engine or global SDK. Add an idempotent upgrade test for already-generated downloader-only projects and ignore/exclude root `.cxx` caches. Native prebuild regeneration passes; a real Gradle configuration assertion confirms the selected staging directory, with `help` successful in28s. Typecheck and15 tests pass. Full C++ compilation, APK installation, Hermes runtime and audible playback remain pending another user-terminal build; configuration success does not close those gates.
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

## Five-phase revision · 17 September 2026

- [x] Phase 1: missing meter defaults to 4/4 in forms/API and guarded database triggers. Migration `202609170018_default_church_meters.sql` applied. Active church has no missing meters; sounday retains its two missing arrangement meters. Existing values and BPM are preserved. Popup retains 36 choices, without the unset action. TypeScript and 31 tests passed; rollback database fixtures and export verification recorded in subsequent checkpoints.
- [ ] Phase 2: atomic service title/key settings and combined playback labels.
- [ ] Phase 3: root-stack Metronome without main tabs or duplicate mini-player.
- [ ] Phase 4: persisted device-local Light/Dark themes across all screens.
- [ ] Phase 5: regression, CI/export, appearance APK rebuild and device acceptance. Native/Hermes, measured timing, route/IEM and five-minute background/lock acceptance remain outstanding until actually exercised.

## Next objectives and carried research

1. **Device acceptance first:** use `docs/device-validation.md`, verify native/Hermes, then triage actual church preparation feedback.
2. **Roster import research:** confirm the church's real CSV columns, role names, family/group entries, multiple names per role, account matching, and how schedules are approved. Manual entry stays the first implementation; do not invent/import a CSV format yet.
3. **Audio validation next:** Frozen Ape Tempo reference confirmed; Latihan Edit/Play foreground-only spike is implemented. Build/launch native/Hermes, implement Android route safety, confirm actual phone/mixer/IEM chain, and measure audio-clock timing before background/lock playback or live use. Custom accents, dotted beats, subdivisions/count-in and other Tempo extras wait for rehearsal feedback.
4. **Smart Add:** decide provider/consent and de-identified fixtures; implement review-gated WhatsApp extraction/matching without silently creating library songs. Carry encrypted expiring job requirements forward.
5. **Medleys and licensing:** medley grouping remains deferred; confirm lyrics licensing/attribution and CCLI before wider rollout (attribution fields exist but do not establish a licence).
6. **Offline and pilot:** upcoming-service prefetch/read-only offline mode, actual background/hardware reliability testing, then a real team pilot.
