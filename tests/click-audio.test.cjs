const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const { Playback } = require("../.test-build/playback.js");

function harness() {
  const events = new Map();
  const calls = [];
  const appState = { currentState: "active" };
  const notification = {
    async show() {
      calls.push("show");
    },
    async hide() {
      calls.push("hide");
    },
    async enableControl(name) {
      calls.push(name);
    },
    addEventListener(name, callback) {
      events.set(name, callback);
      return { remove: () => events.delete(name) };
    },
  };
  const audioManager = {
    async requestNotificationPermissions() {
      return "Granted";
    },
    setAudioSessionOptions() {},
    observeAudioInterruptions(value) {
      if (value === "gain") calls.push("focus");
    },
    addSystemEventListener: notification.addEventListener,
  };
  class Context {
    sampleRate = 8000;
    currentTime = 1;
    state = "running";
    destination = {};
    createBuffer(_, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
    async resume() {
      return true;
    }
    async close() {
      calls.push("close");
    }
    createBufferSource() {
      const context = this;
      return {
        connect() {},
        disconnect() {},
        start() {
          calls.push("audio-start");
          context.currentTime += 0.1;
        },
        stop() {
          calls.push("audio-stop");
        },
      };
    }
  }
  const module = { exports: {} };
  const source = ts.transpileModule(
    fs.readFileSync(require.resolve("../src/lib/clickAudio.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require(name) {
      if (name === "react-native")
        return {
          AppState: appState,
          Platform: { OS: "android" },
          TurboModuleRegistry: { get: () => ({}) },
        };
      if (name === "react-native-audio-api")
        return {
          AudioContext: Context,
          AudioManager: audioManager,
          PlaybackNotificationManager: notification,
        };
      if (name === "../domain/metronome")
        return require("../.test-build/metronome.js");
      throw new Error(name);
    },
  });
  return {
    ...module.exports,
    calls,
    events,
    appState,
    notification,
    audioManager,
  };
}
const settings = { bpm: 120, beats: 4, denominator: 4 };

test("Native loop survives background state; notification Stop silences and disposes it", async () => {
  const h = harness();
  const player = new Playback((_, current) =>
    h.createClickRun(settings, current, () => player.stop()),
  );
  assert.equal(await player.start({}), true);
  assert.ok(h.calls.indexOf("show") < h.calls.indexOf("focus"));
  h.appState.currentState = "background";
  assert.equal(h.calls.includes("audio-stop"), false);
  assert.notEqual(player.beat(), null);
  h.events.get("playbackNotificationStop")();
  assert.equal(player.beat(), null);
  assert.ok(h.calls.includes("audio-stop"));
  assert.ok(h.calls.includes("hide"));
});

test("Stop while notification show is pending cannot leave late notification or sound", async () => {
  const h = harness();
  let finish;
  const shown = new Promise((resolve) => {
    finish = resolve;
  });
  h.notification.show = async () => {
    h.calls.push("show");
    await shown;
  };
  const player = new Playback((_, current) =>
    h.createClickRun(settings, current, () => player.stop()),
  );
  const starting = player.start({});
  for (let index = 0; index < 5; index++) await Promise.resolve();
  assert.ok(h.calls.includes("show"));
  player.stop();
  finish();
  assert.equal(await starting, false);
  assert.equal(h.calls.includes("audio-start"), false);
  assert.equal(h.calls.at(-1), "hide");
});

test("Denied notification permission blocks unattended playback", async () => {
  const h = harness();
  h.audioManager.requestNotificationPermissions = async () => "Denied";
  await assert.rejects(
    h.createClickRun(
      settings,
      () => true,
      () => {},
    ),
    /Izinkan notifikasi/,
  );
  assert.deepEqual(h.calls, []);
});
