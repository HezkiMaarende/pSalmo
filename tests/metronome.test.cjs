const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  clickSettings,
  planClickLoop,
  pulseSample,
  fillClickLoop,
  beatAt,
  tappedBpm,
} = require("../.test-build/metronome.js");
const { Playback } = require("../.test-build/playback.js");

test("Missing/invalid click settings are rejected; compound meters explicitly count denominator pulses", () => {
  for (const [bpm, signature] of [
    [null, "4/4"],
    [19, "4/4"],
    [401, "4/4"],
    [100.1, "4/4"],
    [100, null],
    [100, "0/4"],
    [100, "14/4"],
    [100, "4/3"],
    [100, "100000/16"],
  ]) {
    assert.throws(() => clickSettings(bpm, signature));
  }
  assert.deepEqual(clickSettings(120, "6/8"), {
    bpm: 120,
    beats: 6,
    denominator: 8,
  });
  const loop = planClickLoop(clickSettings(120, "6/8"), 48000);
  assert.equal(loop.pulseSeconds, 0.5);
  assert.equal(loop.pulses % 6, 0);
  assert.equal(pulseSample(loop, 6) / loop.sampleRate, 3);
});

test("All supported tempos/meters use complete bars with bounded sample rounding over 30 minutes", () => {
  for (const sampleRate of [8000, 44100, 48000, 96000]) {
    for (let bpm = 20; bpm <= 400; bpm++) {
      for (let beats = 1; beats <= 13; beats++) {
        const loop = planClickLoop(
          clickSettings(bpm, `${beats}/4`),
          sampleRate,
        );
        assert.equal(loop.pulses % beats, 0);
        assert.ok(loop.duration >= 30 - 1 / sampleRate);
        assert.ok(loop.duration <= 69);
        const nominal = (loop.pulses * 60) / bpm;
        const drift =
          Math.abs(loop.duration - nominal) * Math.ceil(1800 / loop.duration);
        assert.ok(
          drift < 0.004,
          `Nominal rounding drift ${drift}: ${bpm},${beats},${sampleRate}`,
        );
        const samplesPerPulse = loop.pulseSeconds * sampleRate;
        for (let pulse = 1; pulse < loop.pulses; pulse++) {
          const intervalError =
            Math.abs(
              pulseSample(loop, pulse) -
                pulseSample(loop, pulse - 1) -
                samplesPerPulse,
            ) / sampleRate;
          assert.ok(intervalError <= 1 / sampleRate + 1e-12);
        }
      }
    }
  }
  assert.throws(() => planClickLoop(clickSettings(100, "4/4"), 0));
});

test("Generated click PCM has first-beat accent, silence between clicks and matching loop indicator", () => {
  const loop = planClickLoop(clickSettings(137, "3/4"), 8000);
  const pcm = new Float32Array(loop.length);
  fillClickLoop(pcm, loop);
  const peak = (pulse) =>
    Math.max(
      ...pcm
        .slice(pulseSample(loop, pulse), pulseSample(loop, pulse) + 144)
        .map(Math.abs),
    );
  assert.ok(peak(0) > peak(1));
  assert.ok(peak(1) > 0);
  assert.ok(
    pcm.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 0.65),
  );
  assert.equal(pcm[1000], 0);
  assert.equal(beatAt(loop, -0.01), null);
  assert.equal(beatAt(loop, 0), 0);
  for (let pulse = 0; pulse < loop.pulses; pulse++) {
    assert.equal(
      beatAt(loop, (pulseSample(loop, pulse) + 0.1) / loop.sampleRate),
      pulse % 3,
    );
  }
  assert.equal(beatAt(loop, loop.duration + 0.01), 0);
  assert.throws(() => fillClickLoop(new Float32Array(5), loop));
});

test("Tap tempo averages recent intervals and rejects pauses/out-of-range/duplicate taps", () => {
  assert.equal(tappedBpm([0, 500, 1000, 1500]), 120);
  assert.equal(tappedBpm([500]), null);
  assert.equal(tappedBpm([0, 4000]), null);
  assert.equal(tappedBpm([0, 100]), null);
  assert.equal(tappedBpm([0, 0]), null);
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const tick = () => Promise.resolve();
test("Stop cancels a pending native start; late completion never becomes active", async () => {
  const pending = deferred();
  let stopped = 0;
  let current;
  const player = new Playback(async (_, isCurrent) => {
    current = isCurrent;
    await pending.promise;
    return { stop: () => stopped++, beat: () => 1 };
  });
  const starting = player.start({});
  await tick();
  player.stop(); // Also used by next-song, tab blur, background and sign-out.
  assert.equal(current(), false);
  pending.resolve();
  assert.equal(await starting, false);
  assert.equal(player.beat(), null);
  assert.equal(stopped, 1);
  player.stop();
  assert.equal(stopped, 1);
});
test("Competing starts are serialized and only the newest song may become active", async () => {
  const pending = deferred();
  const created = [];
  const stopped = [];
  const player = new Playback(async (song) => {
    created.push(song);
    if (song === 1) await pending.promise;
    return { stop: () => stopped.push(song), beat: () => song };
  });
  const first = player.start(1);
  await tick();
  const skipped = player.start(2);
  const latest = player.start(3);
  pending.resolve();
  assert.equal(await first, false);
  assert.equal(await skipped, false);
  assert.equal(await latest, true);
  assert.deepEqual(created, [1, 3]);
  assert.deepEqual(stopped, [1]);
  assert.equal(player.beat(), 3);
  player.stop();
  assert.deepEqual(stopped, [1, 3]);
});
test("Failed activation leaves stopped state and a later Start can recover", async () => {
  let calls = 0;
  const player = new Playback(async () => {
    if (++calls === 1) throw new Error("Activation failed");
    return { stop() {}, beat: () => 0 };
  });
  await assert.rejects(player.start({}), /Activation failed/);
  assert.equal(player.beat(), null);
  assert.equal(await player.start({}), true);
  assert.equal(player.beat(), 0);
});
