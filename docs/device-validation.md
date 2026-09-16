# Android acceptance checklist

The 16 September five-page implementation has passed TypeScript, pure-domain tests, the Android **JavaScript** export, and authenticated-role SQL tests. These do not validate a native app or Hermes. Check every item below on a real Android device before declaring the objective fully verified.

## Prepare

1. Set all three public `.env` values, including the provisioned church workspace ID, then restart Metro (`npm start`). No privileged keys belong in the app.
2. Sign in as the existing owner. The new church is intentionally empty; `sounday` data is preserved but unavailable in this app's regular flow.
3. Prepare separate owner, ordinary member, and permanent editor accounts. PIC links their exact registered emails through **Beranda → Menu → Kelola Petugas**.

## Exercise

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

Native metronome/Edit/Play, offline prefetch, Smart Add extraction, CSV import, medley groups, mixer/IEM reliability, and a real church pilot belong to subsequent objectives.
