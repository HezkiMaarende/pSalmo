# Android acceptance checklist

The 16 September five-page implementation has passed TypeScript, pure-domain tests, the Android **JavaScript** export, and authenticated-role SQL tests. These do not validate a native app or Hermes. Check every item below on a real Android device before declaring the objective fully verified.

17 September update: native Android APK compilation is independently confirmed from Gradle (`BUILD SUCCESSFUL in2m20s`); package-manager lookup confirms installation on the authorized Galaxy A34, and the user explicitly reports hearing metronome clicks. This closes the first native-build/audible smoke test, not the full checklist. Runtime Hermes inspection, transport/lifecycle controls, persistence, interruption/route safety and recorded timing remain open. See [PROGRESS.md](../PROGRESS.md) for APK size/hash and evidence boundaries.

## Prepare

Metronome/runtime/timing/IEM checks are **deferred at the user's request** while unrelated feature work continues. Keep them unchecked; they still gate live playback/pilot readiness.

## ProPresenter Song Bank import

- [ ] Install the rebuilt APK; choose/cancel text files from Android file providers without broad storage access. Source files remain unchanged; importer cache cleanup works.
- [ ] Trial5–10 actual church songs: verify title/artis/lirik, headings/repeated choruses, attribution/permission,4/4 defaults and explicit key/BPM/meter.
- [ ] Skip duplicate/existing candidates; edit/skipped states, keyboard/font scaling, both themes, permission note and confirm/cancel/Back work.
- [ ] Simulate response loss and retry the frozen UUID/payload; no duplicate creation. Abandoning an uncertain request warns correctly; revoked access prevents commit/replay.
- [ ] Created-song links/results work. Service copies preserve defaults/lyrics/references, and canonical edits leave service snapshots unchanged.

## Local WhatsApp song review

- [ ] From regular Ibadah Add and Metronome Add, paste a numbered list, review all lines, edit/skip headers and deliberately repeated songs, choose ambiguous artists and confirm/cancel.
- [ ] Preview writes nothing; unmatched songs remain service-only; canonical matches copy defaults/lyrics/references and preserve existing birama. No BPM/key is inferred from chat.
- [ ] Two editors preview the same revision; one commit succeeds and the second requests a fresh preview. Invalid/foreign songs cannot partially add a batch.
- [ ] Dirty Back/discard/cancel, keyboard/font scaling, both themes and background/foreground access refresh preserve a memory-only draft. Revoked access prevents confirmation.

## Prepare the metronome pass later

Background-click revision (17 September): rebuild/install the development APK before testing. Start one song, switch tabs/back, open another app and lock for five minutes; clicks should continue. Stop from the global bar and media notification/lock screen; no automatic restart. Test notification-permission denial, rapid Start/Stop/replacement, access revocation on foreground return, sign-out and competing audio. Native device verification is outstanding; swipe-away/force-stop survival is unsupported.

1. Set all three public `.env` values, including the provisioned church workspace ID, then restart Metro (`npm start`). No privileged keys belong in the app.
2. Sign in as the existing owner. The new church is intentionally empty; `sounday` data is preserved but unavailable in this app's regular flow.
3. Prepare separate owner, ordinary member, and permanent editor accounts. PIC links their exact registered emails through **Beranda → Menu → Kelola Petugas**.

## Exercise

### Five-phase revision acceptance · 17 September

Rebuild/install from PowerShell in the repository, with the USB-debugging phone authorized:

```powershell
npm run build:android -- -GradleCache "$env:LOCALAPPDATA\Temp\psalmo-gradle-23f97ab5" -Install -DeviceId <serial-from-adb-devices> -MetroPort 8082
npm run start:dev -- --localhost --port 8082
```

Use pSalmo's development APK, not Expo Go. Keep any existing Metro instance on8082 instead of starting a duplicate. This produces a new native build only if Gradle reports success; the previous APK is not evidence for this revision.

The original five-phase automated checkpoint passed44 tests; the subsequent ProPresenter checkpoint passes TypeScript,64 unit/mock/source-contract tests, complete rollback SQL fixtures and Android JS export (2.02MB). CI passes. A new signed arm64 development APK with native picker and blocked broad storage permissions is built; installation is not yet exercised. These do not establish native UI behavior or real-device timing. Compilation and remaining device gates are tracked separately in PROGRESS.md.

- [ ] First launch is Light even on a Dark phone; Profil → Tampilan switches every app page and Metronome immediately. Dark selection survives process restart, sign-out and another account. There is no System option.
- [ ] Change theme with an unsaved Setlist draft and while clicks are active: draft, current route, selected song and playback remain intact. Verify native Alert/keyboard, loading/error surfaces, drawer and popup; YouTube/OS permission content is not recolored.
- [ ] New manual song defaults to4/4 with no default BPM. Song Bank additions preserve explicit3/4 or6/8. Popup has36 options and no unset action; Cancel/system Back/backdrop preserve the draft.
- [ ] Save title/key/BPM/birama/notes, reopen and confirm `Title - E` (or title-only without key), metadata and mini-player labels. Canonical Song Bank and other services stay unchanged. No automatic chord transposition.
- [ ] Open Metronome from service details under Beranda/Jadwal/Song Bank targets: no main tabs, duplicate bar or leftover space. Its Add route also has no tabs; regular service Add retains tabs. Back returns to the same tab/detail and active audio continues.
- [ ] Entering editable Setlist stops clicks. Dirty draft Back/song/view/Add prompts; cancel retains edits. Busy save blocks leaving. Stop cancels pending activation, including while Metronome loads/errors or Add is open.
- [ ] Both themes work with large font scaling, keyboard and portrait safe areas; controls remain reachable and at least48dp. Lock screen/open another app for at leastfive minutes per test, then Stop from notification/global bar. Record audible continuity and interruption behavior, not only a stopwatch.
- [ ] Independently inspect Hermes runtime, measure actual click timing and verify native route/IEM safety on the real phone/mixer before live use. Synthetic PCM rounding tests are not these measurements.

- [ ] All five tabs, stack back buttons, Android system back, tab switching while inside details, menu overlay/back/dismiss, font scaling, and touch targets work.
- [ ] PIC adds a name before signup; linking an unregistered email fails; linking after signup immediately grants church membership. Roster names do not change when profile names change.
- [ ] PIC creates upcoming IR 1 & 2 and IR 3, enters multiple people per role and guest/group labels, and publishes the schedule independently of setlist approval.
- [ ] A published schedule shows identical IR 1/IR 2 rosters and an independent IR 3 roster. January/December transitions and fifth Sundays work.
- [ ] Ordinary members see only their assigned approved services. Unpublished schedules, no duties, missing services, and assigned-but-unapproved songs show distinct correct states.
- [ ] A permanent editor can maintain Song Bank while off duty, but can prepare draft services only with linked WL/MD duty. WL/MD without permanent editor capability cannot edit. Editors cannot change roster or approve services.
- [ ] Song Bank search, sectioned lyrics, ordered labeled video references, create/edit, and eligible service selection work. Library edits leave existing service snapshots unchanged.
- [ ] Expand/collapse lyrics and video; collapsed video is not loaded; video never autoplays; external fallback works, including YouTube embedding restrictions.
- [ ] Service key/BPM/birama/structure/chords/notes save and refresh. Two clients racing a reorder get one accepted edit and one conflict; refresh displays the complete order.
- [ ] PIC kicks an assigned member; subsequent API requests and screen reopening fail, while old published roster names remain. Cached data already downloaded cannot be remotely recalled.
- [ ] Changing the profile name updates the greeting. Sign-out removes church screens and native encrypted session storage; signing back in restores the correct account.
- [ ] Test background/foreground, access changes while away, poor connectivity, and server errors. No abandoned screen loads repopulate stale content.
- [ ] Build and launch a development/native Android app with Hermes; test process/activity restoration. A `--no-bytecode` export is not this test.

## Deferred, not acceptance claims

The Latihan Edit/Play baseline and app-wide background-click implementation are now implemented; use [latihan-audio.md](latihan-audio.md) for their still-open rebuilt-device gates. Offline prefetch, Smart Add extraction, CSV import, medley groups, native route-safe audio, Recents/process survival, mixer/IEM reliability and a real church pilot remain deferred.
