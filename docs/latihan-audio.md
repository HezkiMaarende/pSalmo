# Latihan — Tempo-inspired native audio spike

Reference confirmed by the user on 16 September 2026: Frozen Ape's [Tempo for Android](https://play.google.com/store/apps/details?id=com.frozenape.tempo) and [Tempo Metronome with Setlist for iOS](https://apps.apple.com/us/app/tempo-metronome-with-setlist/id304731501). Their setlist/preset and performance modes inform this workflow; this is not a full Tempo feature clone.

## Implemented baseline

- Open **Ibadah → Mulai latihan · Edit / Play**. The existing service-detail RLS remains the entry boundary; the screen loads a fresh authorized detail rather than trusting navigation parameters.
- Play shows the ordered song's title, key, BPM, birama, accent/beat indicators, arrangement structure and notes. Its transport controls are Start/Stop and Next Song. No editable settings appear here.
- Next stops the current click and selects the next song; it never auto-starts or wraps from the final song. Stop also cancels an activation that has not finished.
- PIC/admin and permanently authorized, assigned WL/MD editors can enter Edit, select songs, tap or enter BPM, edit birama and notes, and save. Updates touch only these three service-arrangement columns, not canonical songs, lyrics, key, structure or references. Existing RLS enforces the write. Unsaved changes prompt before changing song/mode; Play always uses saved settings. Leaving the screen discards unsaved edits.
- Supported playback: integer BPM 20–400, 1–13 pulses per bar, denominator 2/4/8/16. Missing or unsupported settings block Start rather than silently supplying a tempo. The wider existing arrangement text format remains intact.
- Counting convention: BPM is the denominator-note pulse. **6/8 at 120 BPM means six eighth-note clicks in a three-second bar**, with a stronger first pulse. Dotted-quarter counting, asymmetric accent groups and subdivisions are not implemented.

## Audio architecture and safety limits

Pinned `react-native-audio-api` 0.12.2: the official [compatibility table](https://docs.swmansion.com/react-native-audio-api/docs/other/compatibility/) lists 0.12.x support for React Native 0.81 on the New Architecture. Its [installation guide](https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/getting-started/) requires a native development build, not Expo Go. Worklet nodes are not used, so the optional worklets dependency is not installed.

Audio API is required lazily only after checking `AudioAPIModule`. Expo Go retains navigation/Edit/notes but shows the native-build explanation and disables Start. Web playback is deliberately unsupported in this spike.

Generate one mono PCM loop containing at least 30 seconds of complete bars. Each pulse is placed using its absolute ideal sample position, then rounded; the loop length is rounded once. The native [AudioBufferSourceNode](https://docs.swmansion.com/react-native-audio-api/docs/sources/audio-buffer-source-node/) loops that buffer. No JavaScript timer schedules sound. A 40ms display timer reads `AudioContext.currentTime`; its LEDs are not latency measurements.

Across supported BPM/meters and sample rates, tests bound **nominal sample-rounding** drift below 4ms over 30 minutes. This excludes actual device clock error, buffering, output latency, interruption delivery and USB/mixer behavior. It does not establish the design's <=5ms click error / <=20ms measured drift acceptance gate. Buffer memory is bounded to roughly 69 seconds of mono PCM (under 27MB at 96kHz), plus native engine overhead; actual memory and Start latency remain to be measured.

This first spike is foreground-only: blur/tab switch, sign-out/unmount, inactive/background/screen lock, refresh, reported audio interruption, ducking or route change stops sound and requires explicit Start. iOS uses a playback session (no microphone request, no mixing/automatic resume). The Expo plugin disables background modes, foreground-service permissions and unused FFmpeg support. Follow the system media volume; app-specific volume and left/right click routing are deferred.

Route/interruption listeners use [AudioManager](https://docs.swmansion.com/react-native-audio-api/docs/system/audio-manager/). **Android route-change emission is not implemented in the inspected 0.12.2 Android source**; do not rely on it to mute a disconnected IEM cable before speaker fallback. Native-side Android route safety is a next required step before live use. No background/lock-screen playback or hardware-safe routing is claimed.

## Build and validate next

With Node24, Android SDK and supported JDK installed:

```sh
npm ci
npm run build:android
# Or compile and install onto an explicitly selected authorized USB device:
# npm run build:android -- -Install -DeviceId <serial-from-adb-devices>
npm run start:dev
```

On Windows, `scripts/build-android.ps1` creates a fresh short physical source copy under TEMP (`psn-xxxxxxxx`, root at most60 characters), installs locked dependencies using the source repository's npm cache, and generates Android there (`npm run generate:android`). The local `.env` is copied for build configuration but never printed or published. Existing source/dependencies/native caches are not moved or deleted; Git, dependencies and generated output are excluded from copying. A symlink/drive alias is not used because tools may resolve it back to the long path. The script compiles an arm64 debug development client with Hermes/New Architecture and the audio module, copies its APK back into the original repository's ignored `artifacts/`, and prints its SHA256. Pass another supported `-Architecture` for another device/emulator. It reuses a short Gradle cache under TEMP with `--build-cache`, isolated SDK preferences through [ANDROID_USER_HOME](https://developer.android.com/tools/variables), and in-process Kotlin compilation. `-PrepareOnly` checks copying, dependency installation and native-project generation without compiling/installing. `-NativeBuildParent` selects another existing short parent folder if TEMP is too long. Previous temporary builds are retained for diagnosis and never recursively cleaned by this script. Existing USB authorization is retained when installing. Missing SDK/NDK components may download into the configured SDK; SDK licences must already be accepted.

`plugins/withWindowsAudioBuild.js` replaces only the audio dependency's Unix-shell archive-download task on Windows. The app-owned PowerShell/Node downloader uses the same official `rn-audio-libs` release tag read from the installed package, downloads only `android.zip` over verified HTTPS, prints the archive SHA256 and marks success only after extraction. FFmpeg stays disabled; no iOS/macOS archives or Unix symlink cleanup are needed. The audio engine is not patched. Other platforms retain the upstream downloader.

The plugin also configures only the Windows audio module's [CMake buildStagingDirectory](https://developer.android.com/reference/tools/gradle-api/8.11/com/android/build/api/dsl/Cmake) through Android Components `finalizeDsl`, placing CMake output at the short build root's `.cxx/a` instead of under `node_modules/react-native-audio-api/android/.cxx`. A short source root alone is insufficient: the user's subsequent4m33s build reaches the audio module but Ninja cannot create a nested object directory; CMake reports an184-character object-directory base before the source-name suffix. Shortening the output base leaves more space for [CMake's standard object-path hashing](https://cmake.org/cmake/help/latest/variable/CMAKE_OBJECT_PATH_MAX.html). No engine source, Windows registry, TLS policy or global SDK binary is changed. The new marker upgrades existing downloader-only prebuilds idempotently. Gradle configuration verification confirms `.cxx/a` is actually selected (`help` succeeds in28s); this is not a full native compile or APK success. Generated `.cxx` output is ignored and excluded from staging.

`-Install -DeviceId` installs only on the selected authorized device and forwards Metro's port8081 over USB (override with `-MetroPort 8082`). The installed **pSalmo** app is separate from Expo Go: sign in again with the same account. There is no token copying or new account requirement. The development APK needs a running Metro server; it is not a standalone offline/release APK. If port8081 belongs to another server, build/install with `-MetroPort 8082`, use `npm run start:dev -- --localhost --port 8082`, then open `http://127.0.0.1:8082` from the development launcher. Do not start another server on a port already serving this project.

The 16 September local attempt completes Java/Kotlin compilation but stalls at CMake's compiler-ABI check. A minimal independent Ninja task also stalls with both SDK Ninja1.10.2 and official Ninja1.13.2; this indicates a restricted-runner issue, not a proven C++ source error. No APK or audio success is recorded. Run the script in your own PowerShell window to continue, passing `-GradleCache` with the existing cache path to reuse downloads and compiled modules. Do not disable sandbox/TLS protections or patch the audio engine to mask this stall.

The subsequent user-terminal attempt gets past that stall but reports an actual Windows path error: AsyncStorage's generated C++ source filename is265 characters (`Filename longer than 260 characters`), followed by ExpoModulesCore's CMake regeneration loop (`build.ninja still dirty after 100 tries`). The fresh short-copy workflow above reduces the same source path to218 characters in the preparation check. It avoids reusing absolute-path CMake output from the original folder. This addresses the verified path-length failure; successful full C++ compilation, APK installation and audio still require the user-terminal retry. Similar path warnings/regeneration failures are reported in [Expo issue22444](https://github.com/expo/expo/issues/22444).

`npm run android` (`expo run:android`) is the standard alternative local build/install command. Use `npm run start:go` only for settings/UI checks without native audio. An iOS build requires a Mac/Xcode (`npm run ios`). No paid cloud builds or store uploads are configured. A development build is the [Expo-supported route for custom native libraries](https://docs.expo.dev/develop/development-builds/introduction/).

- [ ] Launch native/Hermes, sign in and start a configured setlist song. Record phone model, OS, runtime, sample rate and Start latency/memory.
- [ ] Verify first-beat accent, 3/4, 4/4, 6/8, extreme supported BPM, last-song behavior and no edit widgets in Play.
- [ ] Save Edit settings; reopen to prove persistence. Verify ordinary members cannot save via API and authorized WL/MD cannot edit unrelated services. Check IR1/2 stay shared and IR3 independent.
- [ ] Rapid Start/Stop/Next, pending activation cancellation, tab/back navigation, sign-out, screen lock/background/foreground and service-access refresh never resume sound unexpectedly.
- [ ] Test calls/notifications/other audio; recovery always requires explicit Start. Test silent switch on iOS.
- [ ] Implement/test native Android output-route detection and immediate safety stop; test wired/USB disconnects and sample-rate changes on both platforms before mixer/IEM use.
- [ ] Record wired/USB output for 30 minutes and measure timing against the audio clock. Do not close the timing gate based on JavaScript tests or LEDs.

## Deferred controls and research

Custom accent/off patterns, dotted beat units, subdivisions/swing, count-in, medleys, sound choices, output pan/volume, practice timer/automator/coach, remote pedals and auto-advance are not part of this baseline. Confirm these controls from actual rehearsal feedback before expanding. Background/lock playback needs a dedicated native lifecycle/route-safe implementation and hardware validation. The church's actual phone/mixer/IEM chain remains unconfirmed.
