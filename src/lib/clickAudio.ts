import { AppState, Platform, TurboModuleRegistry } from "react-native";
import type {
  AudioContext,
  AudioBufferSourceNode,
} from "react-native-audio-api";
import {
  beatAt,
  fillClickLoop,
  planClickLoop,
  ClickSettings,
} from "../domain/metronome";
import type { PlaybackRun } from "../domain/playback";

export const nativeClickAvailable =
  Platform.OS !== "web" && !!TurboModuleRegistry.get("AudioAPIModule");
export const nativeClickNotice =
  "Start dinonaktifkan karena audio native belum tersedia dalam versi ini (misalnya Expo Go). Buka aplikasi pSalmo development yang terpasang, bukan Expo Go. Mode Edit dan catatan tetap dapat digunakan.";

export async function createClickRun(
  settings: ClickSettings,
  current: () => boolean,
  safetyStop: (message: string) => void,
  title = "Metronome pSalmo",
  serviceTitle = "Latihan",
): Promise<PlaybackRun> {
  if (!nativeClickAvailable) throw new Error(nativeClickNotice);
  // Type-only imports above are erased. Never evaluate native initialization in
  // Expo Go; loading this module must not break the existing five-page app.
  const {
    AudioContext: Context,
    AudioManager,
    PlaybackNotificationManager: notification,
  } = require("react-native-audio-api") as typeof import("react-native-audio-api");
  let context: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null;
  let stopped = false;
  let notificationShown = false;
  let cleanup: Promise<void> | undefined;
  const subscriptions: { remove(): void }[] = [];
  function stop() {
    if (stopped) return cleanup;
    stopped = true;
    subscriptions.forEach((subscription) => subscription.remove());
    try {
      source?.stop();
    } catch {
      /* Already stopped or not started. */
    }
    try {
      source?.disconnect();
    } catch {
      /* Cleanup must finish even after native failure. */
    }
    source = null;
    const closing = context;
    context = null;
    try {
      AudioManager.observeAudioInterruptions(false);
    } catch {
      /* Never resume automatically. */
    }
    cleanup = Promise.all([
      closing?.close().catch(() => {}),
      notificationShown ? notification.hide().catch(() => {}) : undefined,
    ]).then(() => {});
    return cleanup;
  }
  function interrupt(message: string) {
    stop();
    safetyStop(message);
  }
  try {
    if (Platform.OS === "android") {
      const permission = await AudioManager.requestNotificationPermissions();
      if (permission !== "Granted")
        throw new Error(
          "Izinkan notifikasi agar tombol Stop tersedia saat layar terkunci. Jika izin tidak muncul, pasang APK pSalmo terbaru.",
        );
    }
    if (!current()) return { stop, beat: () => null };
    if (AppState.currentState !== "active")
      throw new Error("Kembali ke aplikasi lalu tekan Start.");
    for (const event of [
      "playbackNotificationStop",
      "playbackNotificationPause",
      "playbackNotificationDismissed",
    ] as const)
      subscriptions.push(
        notification.addEventListener(event, () =>
          interrupt("Pemutar dihentikan dari kontrol media."),
        ),
      );
    // Establish the media-playback foreground service before requesting audio
    // focus (required for apps targeting Android 15+). Never remote-autostart.
    notificationShown = true;
    await notification.show({ title, artist: serviceTitle, state: "playing" });
    if (!current() || stopped) {
      await stop();
      // Stop may have hidden the notification while show was still in flight.
      await notification.hide();
      return { stop, beat: () => null };
    }
    await notification.enableControl("stop", true);
    if (!current() || stopped) {
      await stop();
      await notification.hide();
      return { stop, beat: () => null };
    }
    AudioManager.setAudioSessionOptions({
      iosCategory: "playback",
      iosMode: "default",
      iosOptions: [],
    });
    subscriptions.push(
      AudioManager.addSystemEventListener("interruption", (event) => {
        if (event.type === "began")
          interrupt(
            "Audio terinterupsi. Tekan Start untuk melanjutkan setelah aman.",
          );
      }),
    );
    subscriptions.push(
      AudioManager.addSystemEventListener("duck", () =>
        interrupt("Audio focus berubah. Pemutar dihentikan."),
      ),
    );
    subscriptions.push(
      AudioManager.addSystemEventListener("routeChange", (event) => {
        if (event.reason !== "CategoryChange")
          interrupt(
            "Output audio berubah. Periksa kabel/output sebelum menekan Start.",
          );
      }),
    );
    AudioManager.observeAudioInterruptions("gain");
    if (!current() || stopped) {
      await stop();
      return { stop, beat: () => null };
    }
    context = new Context();
    const activeContext = context;
    const loop = planClickLoop(settings, activeContext.sampleRate);
    const buffer = activeContext.createBuffer(1, loop.length, loop.sampleRate);
    // Fill the native buffer directly: no extra full-size PCM copy.
    fillClickLoop(buffer.getChannelData(0), loop);
    const resumed = await activeContext.resume();
    if (!current() || stopped) {
      await stop();
      return { stop, beat: () => null };
    }
    if (!resumed || activeContext.state !== "running")
      throw new Error(
        "Audio tidak dapat diaktifkan. Periksa output lalu coba Start kembali.",
      );
    source = activeContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(activeContext.destination);
    const startAt = activeContext.currentTime + 0.05;
    source.start(startAt);
    return {
      stop,
      beat: () =>
        stopped || activeContext.state !== "running"
          ? null
          : beatAt(loop, activeContext.currentTime - startAt),
    };
  } catch (error) {
    await stop();
    throw error;
  }
}
