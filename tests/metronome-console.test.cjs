const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");

function harness(overrides = {}) {
  let view = true;
  const calls = [];
  const react = {
    createElement(type, props, ...children) {
      return { type, props: { ...props, children } };
    },
    useState() {
      return [
        view,
        (next) => {
          view = typeof next === "function" ? next(view) : next;
        },
      ];
    },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(
    fs.readFileSync(
      require.resolve("../src/components/MetronomeConsole.tsx"),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require(name) {
      if (name === "react")
        return { __esModule: true, default: react, useState: react.useState };
      if (name === "react-native")
        return {
          Alert: { alert() {} },
          Pressable: "Pressable",
          ScrollView: "ScrollView",
          Text: "Text",
          View: "View",
          StyleSheet: { create: (value) => value },
        };
      if (name === "./ui") return { Feedback: () => null };
      throw new Error(name);
    },
  });
  const songs = [1, 2, 3].map((id) => ({
    id: String(id),
    proposed_title: `Song ${id}`,
    bpm: 120,
    time_signature: "6/8",
    structure: [],
  }));
  const props = {
    detail: {
      service: { title: "Ibadah Raya 1 & 2" },
      items: songs,
      can_edit: true,
    },
    item: songs[0],
    index: 0,
    settings: { bpm: 120, beats: 6, denominator: 8 },
    beat: 0,
    playing: false,
    starting: false,
    mode: "play",
    busy: false,
    error: "",
    audioAvailable: true,
    audioNotice: "",
    children: null,
    onSelect: (id) => calls.push(`select:${id}`),
    onStart: () => calls.push("start"),
    onStop: () => calls.push("stop"),
    onMode: (mode) => calls.push(`mode:${mode}`),
    onAdd: () => calls.push("add"),
    ...overrides,
  };
  function expand(element) {
    if (!element || typeof element !== "object") return element;
    if (Array.isArray(element)) return element.map(expand);
    if (typeof element.type === "function")
      return expand(element.type(element.props));
    return {
      ...element,
      props: { ...element.props, children: element.props.children.map(expand) },
    };
  }
  function flatten(element) {
    if (!element || typeof element !== "object") return [];
    if (Array.isArray(element)) return element.flatMap(flatten);
    return [element, ...flatten(element.props.children)];
  }
  const render = () => flatten(expand(module.exports.MetronomeConsole(props)));
  const find = (label) =>
    render().find((element) => element.props.accessibilityLabel === label);
  return { calls, render, find, props };
}

test("Setlist/Practice switch preserves playback and renders actual meter pulses", () => {
  const h = harness();
  const indicator = h.find("Ketukan 1 dari 6");
  assert.equal(indicator.props.children[0].length, 6);
  assert.ok(h.find("1. Song 1, 120 BPM, 6/8"));
  h.find("Tampilkan Practice").props.onPress();
  assert.equal(h.find("1. Song 1, 120 BPM, 6/8"), undefined);
  assert.ok(h.find("Kembali ke daftar lagu"));
  assert.deepEqual(h.calls, []);
});

test("Transport is outside the scrolling content; boundaries disable skips", () => {
  const h = harness();
  const root = h.render()[0];
  const children = root.props.children.filter(Boolean);
  assert.equal(children.at(-2).type, "ScrollView");
  assert.equal(children.at(-1).type, "View");
  assert.equal(h.find("Lagu sebelumnya").props.disabled, true);
  h.find("Lagu berikutnya").props.onPress();
  assert.deepEqual(h.calls, ["select:2"]);
  h.props.index = 2;
  assert.equal(h.find("Lagu berikutnya").props.disabled, true);
});

test("Running and pending transport expose Stop; Expo Go blocks Play", () => {
  const h = harness({ starting: true });
  h.find("Stop metronome").props.onPress();
  assert.deepEqual(h.calls, ["stop"]);
  h.props.starting = false;
  h.props.audioAvailable = false;
  assert.equal(h.find("Mulai metronome").props.disabled, true);
});

test("Ordinary members have no add/edit actions; Edit hides playback dock", () => {
  const h = harness();
  h.props.detail.can_edit = false;
  assert.equal(h.find("Tambah lagu ke ibadah"), undefined);
  assert.equal(
    h.render().some((element) => element.props.children?.includes("Edit")),
    false,
  );
  h.props.mode = "edit";
  assert.equal(h.find("Mulai metronome"), undefined);
  assert.equal(h.find("Lagu berikutnya"), undefined);
});
