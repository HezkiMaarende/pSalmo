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
npx expo run:android
```

This generates the native Android project and installs a debug native build on a connected device/emulator, including the audio module. Use an authorized device; it is not an Expo Go session. For subsequent launches use `npx expo start --dev-client` and the installed native app. An iOS build requires a Mac/Xcode (`npx expo run:ios`). No paid cloud builds or store uploads are configured.

- [ ] Launch native/Hermes, sign in and start a configured setlist song. Record phone model, OS, runtime, sample rate and Start latency/memory.
- [ ] Verify first-beat accent, 3/4, 4/4, 6/8, extreme supported BPM, last-song behavior and no edit widgets in Play.
- [ ] Save Edit settings; reopen to prove persistence. Verify ordinary members cannot save via API and authorized WL/MD cannot edit unrelated services. Check IR1/2 stay shared and IR3 independent.
- [ ] Rapid Start/Stop/Next, pending activation cancellation, tab/back navigation, sign-out, screen lock/background/foreground and service-access refresh never resume sound unexpectedly.
- [ ] Test calls/notifications/other audio; recovery always requires explicit Start. Test silent switch on iOS.
- [ ] Implement/test native Android output-route detection and immediate safety stop; test wired/USB disconnects and sample-rate changes on both platforms before mixer/IEM use.
- [ ] Record wired/USB output for 30 minutes and measure timing against the audio clock. Do not close the timing gate based on JavaScript tests or LEDs.

## Deferred controls and research

Custom accent/off patterns, dotted beat units, subdivisions/swing, count-in, medleys, sound choices, output pan/volume, practice timer/automator/coach, remote pedals and auto-advance are not part of this baseline. Confirm these controls from actual rehearsal feedback before expanding. Background/lock playback needs a dedicated native lifecycle/route-safe implementation and hardware validation. The church's actual phone/mixer/IEM chain remains unconfirmed.
