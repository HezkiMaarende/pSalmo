# Private non-live pilot readiness

This checkpoint prepares pSalmo for private Android testing of scheduling,
permissions, Song Bank and encrypted read-only offline access. It is not an
approval to use the metronome with a live mixer or IEM system.

## Automated baseline · 3 October 2026

- GitHub App checks run 31 succeeds for commit `078f7e4`.
- A clean locked install, TypeScript, all 83 tests and the Android JavaScript
  export pass locally. The export contains 1,025 modules and a 2.04 MB bundle.
- Weekly workflow, reviewed-song batch, TXT import and native ProPresenter
  rollback fixtures pass against the connected Supabase project. Synthetic
  accounts, churches and content are rolled back.
- The Supabase project was restored from inactivity before those checks. The
  Security Advisor still reports the documented guarded `SECURITY DEFINER`
  RPC notices, a deliberately private receipt table with no client policy, and
  leaked-password protection disabled. No schema or Auth setting was changed.
- A fresh production-dependency audit has no critical advisory. Its 4 moderate
  and 56 high dependency-node reports propagate from build-tool paths used by
  Expo/Metro/Jest/Xcode (`image-size`, PostCSS, `braces`, `node-forge` and
  `uuid`). There is no compatible lockfile-only fix; do not run a forced SDK
  upgrade during this pilot checkpoint.

These checks verify contracts and build inputs. They do not replace phone,
Hermes-runtime or hardware evidence.

The read-only live baseline contains one owner membership, no linked roster
people or other role accounts, five Song Bank entries, one draft service, one
approved service and no published week. Nothing was changed by this check.
Register and link two real pilot accounts before starting the matrix; do not
invent emails, assignments or a published schedule merely to close a box.

## Pilot accounts and safe data

Use three separately registered accounts in the configured GPdI Elshaddai
workspace:

1. owner/PIC;
2. ordinary member;
3. permanent Song Bank editor who is linked to WL or MD duty on one designated
   unpublished future service.

Use only legitimate unpublished future services for edits. Approved services
and the `sounday` prototype are read-only during this pilot. If the ordinary
member is kicked to test revocation, re-link the same roster person afterward
when that account remains a participant; the historical roster label must stay
unchanged.

## Required phone matrix

- [ ] Owner/PIC can manage roster, schedules, service lifecycle and Song Bank.
- [ ] Ordinary member can browse published schedules, opens only an assigned
      approved service and cannot edit/import/publish through UI or API.
- [ ] Permanent editor can maintain Song Bank while off duty, but edits a
      service only while assigned as linked WL/MD.
- [ ] IR1/IR2 stay shared and IR3 stays independent.
- [ ] Five-song review uses AJAIB KAU TUHAN plus four existing native imports
      with available local originals. Check ProPresenter order, headings,
      repetitions, lyrics and attribution manually; do not commit source files,
      lyrics or hashes.
- [ ] Picker cancel, preview discard, duplicate skip, frozen retry, reopening,
      both themes, keyboard, large text and compact Song Bank rows pass.
- [ ] One reviewed song copies into an editable unpublished service. Later
      canonical edits leave that service snapshot unchanged.
- [ ] All tabs, drawer, Android Back, profile greeting, YouTube lazy load and
      fallback, draft saving and both themes pass.
- [ ] Pengumuman active feed/Home preview, owner lifecycle controls, member
      read-only boundary, HTTPS handoff and V2 offline cold start pass.
- [ ] After an explicit online offline-data refresh, airplane-mode cold launch
      shows only cached Home/Jadwal/authorized details with OFFLINE/read-only
      notices. Song Bank, Practice, video and every write remain blocked.
- [ ] Reconnect, sign-out, account switch, manual clear and membership
      revocation invalidate access correctly. Automated tests retain coverage
      for ciphertext tampering, wrong keys and the exact seven-day boundary.

## Standalone preview gate

Run `npm run build:share`. Accept only a newly completed and verified
`artifacts/psalmo-preview-universal.apk`. Record its size and SHA256, then
install it locally and launch it with Metro stopped and USB disconnected.
Initial sign-in and cache refresh require network access; the refreshed
four-Sunday snapshot is read-only offline.

Send the verified APK privately as a WhatsApp Document. Testers report the APK
hash, phone model, Android version, account role, theme, connectivity state,
steps and screenshot. Never send `.env`, keys, tokens, owner credentials,
source ProPresenter files or church lyrics.

The 3 October automated attempt did not close this gate. The reused default
Gradle cache first failed on a missing `metadata.bin`; a fresh named cache then
completed staging, prebuild and verified audio-library preparation but stalled
in idle CMake/Ninja compiler-ABI checks. Only that attempt's verified process
tree was stopped. It produced no APK, and the older 17 September artifact was
left unchanged. Retry from the user's normal PowerShell with:

```powershell
npm run build:share -- -GradleCache "$env:LOCALAPPDATA\Temp\psalmo-gradle-pilot-20261003"
```

Do not send the previous artifact or infer success from a retained file.

The preview uses the Expo template test signing key. It is not a production or
store release. Installation failure, crash, unauthorized access, stale access
after revocation, data loss, incorrect imports, offline data exposure or writes
to approved services block the pilot.

## Deliberately still open

- [ ] Independent Hermes-runtime inspection.
- [ ] Measured click latency, drift and memory/sample-rate evidence.
- [ ] Background/screen-lock playback acceptance.
- [ ] Android route-disconnect protection and real mixer/IEM validation.
- [ ] Production signing and public/store distribution.
