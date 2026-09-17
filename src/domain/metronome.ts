export interface ClickSettings {
  bpm: number;
  beats: number;
  denominator: number;
}

// Common UI choices. The driver still accepts previously saved 13-beat/16th
// meters; narrowing the picker must not silently rewrite legacy arrangements.
export const timeSignatureOptions: readonly string[] = Array.from(
  { length: 12 },
  (_, index) => [2, 4, 8].map((denominator) => `${index + 1}/${denominator}`),
).flat();

// BPM counts denominator-note pulses: 6/8 has six eighth-note clicks per bar.
// Dotted-quarter counting and custom accent groupings are deliberately deferred.
export function clickSettings(
  bpm: number | null,
  signature: string | null,
): ClickSettings {
  if (!Number.isInteger(bpm) || bpm === null || bpm < 20 || bpm > 400)
    throw new Error("Atur BPM lagu (20–400) sebelum memutar.");
  const match = /^(\d+)\/(2|4|8|16)$/.exec(signature || "");
  const beats = match ? Number(match[1]) : 0;
  if (beats < 1 || beats > 13)
    throw new Error(
      "Pemutar mendukung 1–13 ketukan dengan penyebut 2, 4, 8, atau 16. Atur birama lagu terlebih dahulu.",
    );
  return { bpm, beats, denominator: Number(match![2]) };
}

export interface ClickLoop {
  sampleRate: number;
  length: number;
  pulses: number;
  duration: number;
  pulseSeconds: number;
  settings: ClickSettings;
}

export function planClickLoop(
  settings: ClickSettings,
  sampleRate: number,
): ClickLoop {
  clickSettings(settings.bpm, `${settings.beats}/${settings.denominator}`);
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000)
    throw new Error("Sample rate audio tidak didukung.");
  const pulseSeconds = 60 / settings.bpm;
  // At least 30 seconds of complete bars. Rounding occurs once per long loop,
  // not once per pulse; this bounds nominal 30-minute rounding drift <4ms even
  // at 8kHz. This mathematical bound is NOT a device/output timing measurement.
  const bars = Math.max(1, Math.ceil(30 / (pulseSeconds * settings.beats)));
  const pulses = bars * settings.beats;
  const length = Math.round(pulses * pulseSeconds * sampleRate);
  return {
    sampleRate,
    length,
    pulses,
    duration: length / sampleRate,
    pulseSeconds,
    settings,
  };
}

export function pulseSample(loop: ClickLoop, pulse: number): number {
  return Math.round(pulse * loop.pulseSeconds * loop.sampleRate);
}

export function fillClickLoop(output: Float32Array, loop: ClickLoop): void {
  if (output.length !== loop.length)
    throw new Error("Ukuran buffer tidak sesuai.");
  output.fill(0);
  const clickLength = Math.round(loop.sampleRate * 0.018);
  for (let pulse = 0; pulse < loop.pulses; pulse++) {
    const start = pulseSample(loop, pulse);
    const accent = pulse % loop.settings.beats === 0;
    for (
      let sample = 0;
      sample < clickLength && start + sample < output.length;
      sample++
    ) {
      const time = sample / loop.sampleRate;
      const attack = Math.min(1, time / 0.001);
      const envelope =
        attack * Math.exp(-time * 260) * (1 - sample / clickLength);
      output[start + sample] =
        (accent ? 0.65 : 0.4) *
        envelope *
        Math.sin(2 * Math.PI * (accent ? 1800 : 1200) * time);
    }
  }
}

export function beatAt(loop: ClickLoop, elapsedSeconds: number): number | null {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return null;
  // Match the rounded PCM pulse boundaries, including the loop wrap.
  const sample = Math.floor((elapsedSeconds % loop.duration) * loop.sampleRate);
  let pulse = Math.min(
    loop.pulses - 1,
    Math.floor(sample / (loop.pulseSeconds * loop.sampleRate)),
  );
  if (pulse + 1 < loop.pulses && sample >= pulseSample(loop, pulse + 1))
    pulse++;
  if (pulse > 0 && sample < pulseSample(loop, pulse)) pulse--;
  return pulse % loop.settings.beats;
}

export function tappedBpm(taps: number[]): number | null {
  if (taps.length < 2) return null;
  const intervals = taps.slice(1).map((time, i) => time - taps[i]);
  if (intervals.some((interval) => interval <= 0 || interval > 3000))
    return null;
  const bpm = Math.round(
    60000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length),
  );
  return bpm >= 20 && bpm <= 400 ? bpm : null;
}
