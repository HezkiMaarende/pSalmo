# Private APK sharing through WhatsApp

The development APK requires Metro. Do not send it to a remote tester. Build a standalone preview instead:

```powershell
npm run build:share
```

Requires the existing JDK/Android SDK setup and the configured local `.env`. The command creates a fresh short TEMP copy, bundles the app with release/Hermes tooling and includes arm64-v8a, armeabi-v7a and x86_64. It checks public Supabase configuration, APK signature, non-debuggable manifest, requested ABIs and embedded bundle before copying a successful result to:

`artifacts/psalmo-preview-universal.apk`

Only use an APK from a successful build; an older file may remain after a failure. Compare the printed SHA256 if needed. For an explicitly known phone architecture, use `npm run build:android -- -Variant preview -Architecture arm64-v8a` instead.

This preview uses the Expo template **test signing key**, not a private production signing identity. Share privately for testing only; establish protected release signing before public/store distribution. A bundled APK is not evidence of Hermes runtime, measured audio timing or safe IEM routing. Do not use it in a live church mixer/IEM chain before hardware acceptance.

## Test and send

1. Install the preview on an Android phone and open it with USB disconnected and Metro stopped. Verify login and basic navigation. Initial sign-in and **Perbarui data offline** require Internet; after a successful refresh, Home, Jadwal and authorized cached service details are available read-only for the documented offline window. Do not claim offline acceptance until the phone checklist passes.
2. Copy the APK to your phone, or use WhatsApp on your computer. In your friend's chat, attach it as a **Document/file**, not a photo/video. Send only the APK, never `.env`, signing files, account tokens or service-role credentials.
3. Your friend downloads and opens the APK on Android. If prompted, allow installation from the trusted app used to open this file, then disable that permission afterward. Keep Play Protect enabled; investigate warnings rather than bypassing them. APKs cannot be installed on iPhone.
4. The friend creates their own pSalmo account. PIC links their exact registered email in **Kelola Petugas** to grant church membership; appropriate duties/approval determine service access. Do not share the owner's password.
5. For the non-live pilot, record phone model/Android version, account role, theme, connectivity state, reproduction steps, screenshot and the APK SHA256. Do not connect the metronome to a live mixer/IEM chain. Background, screen-lock, Hermes, timing and route/IEM acceptance gates remain separate.

If an existing installation reports a signature mismatch, do not uninstall automatically: uninstalling can remove local preferences/drafts. Check the installed build's signing identity and choose a deliberate migration/update path first.
