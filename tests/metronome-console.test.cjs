const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");

function harness(overrides = {}) {
  const calls = [];
  const react = {
    createElement(type, props, ...children) {
      return { type, props: { ...props, children } };
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
      if (name === "react") return { __esModule: true, default: react };
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
    view: "setlist",
    busy: false,
    error: "",
    audioAvailable: true,
    audioNotice: "",
    children: null,
    onSelect: (id) => calls.push(`select:${id}`),
    onStart: () => calls.push("start"),
    onStop: () => calls.push("stop"),
    onView: (view) => {
      calls.push(`view:${view}`);
      props.view = view;
    },
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

test("Setlist/Practice switch uses the parent guard and renders actual meter pulses", () => {
  const h = harness();
  const indicator = h.find("Ketukan 1 dari 6");
  assert.equal(indicator.props.children[0].length, 6);
  assert.ok(h.find("1. Song 1, 120 BPM, 6/8"));
  h.find("Tampilkan Practice").props.onPress();
  assert.equal(h.find("1. Song 1, 120 BPM, 6/8"), undefined);
  assert.ok(h.find("Kembali ke daftar lagu"));
  assert.deepEqual(h.calls, ["view:practice"]);
});

test("Transport is outside the scrolling content; boundaries disable skips", () => {
  const h = harness({ view: "practice" });
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
  const h = harness({ view: "practice", starting: true });
  h.find("Stop metronome").props.onPress();
  assert.deepEqual(h.calls, ["stop"]);
  h.props.starting = false;
  h.props.audioAvailable = false;
  assert.equal(h.find("Mulai metronome").props.disabled, true);
});

test("Setlist contains authorized editing, never a separate Edit tab; Practice hides all editor controls", () => {
  const h = harness();
  h.props.children = { type: "Text", props: { children: ["Inline editor"] } };
  assert.ok(h.find("Tambah lagu ke ibadah"));
  assert.ok(
    h
      .render()
      .some((element) => element.props.children?.includes("Inline editor")),
  );
  assert.equal(h.find("Mulai metronome"), undefined);
  assert.equal(
    h.render().some((element) => element.props.children?.includes("Edit")),
    false,
  );
  h.props.view = "practice";
  assert.equal(h.find("Tambah lagu ke ibadah"), undefined);
  assert.equal(
    h
      .render()
      .some((element) => element.props.children?.includes("Inline editor")),
    false,
  );
  assert.ok(h.find("Mulai metronome"));
  h.props.view = "setlist";
  h.props.detail.can_edit = false;
  assert.equal(h.find("Tambah lagu ke ibadah"), undefined);
  assert.equal(
    h.render().some((element) => element.props.children?.includes("Edit")),
    false,
  );
  assert.equal(
    h
      .render()
      .some((element) => element.props.children?.includes("Inline editor")),
    false,
  );
  assert.equal(h.find("Mulai metronome"), undefined);
  assert.equal(h.find("Lagu berikutnya"), undefined);
});

test("Saving disables every view switch and add action", () => {
  const h = harness({ busy: true });
  assert.equal(h.find("Tampilkan Practice").props.disabled, true);
  assert.equal(h.find("Fokus pada lagu").props.disabled, true);
  assert.equal(h.find("Tambah lagu ke ibadah").props.disabled, true);
  const tabs = h
    .render()
    .filter(
      (element) =>
        element.type === "Pressable" &&
        element.props.children[0]?.props?.children?.some(
          (text) => text === "Setlist" || text === "Practice",
        ),
    );
  assert.equal(tabs.length, 2);
  assert.ok(tabs.every((tab) => tab.props.disabled));
});

function pickerHarness(overrides = {}) {
  let open = false;
  const changes = [];
  const react = {
    createElement: (type, props, ...children) => ({
      type,
      props: { ...props, children },
    }),
    useState: () => [
      open,
      (next) => {
        open = next;
      },
    ],
  };
  const module = { exports: {} };
  const source = ts.transpileModule(
    fs.readFileSync(
      require.resolve("../src/components/TimeSignaturePicker.tsx"),
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
          Modal: "Modal",
          Pressable: "Pressable",
          ScrollView: "ScrollView",
          Text: "Text",
          View: "View",
          useWindowDimensions: () => ({ height: 720 }),
          StyleSheet: { create: (value) => value, absoluteFillObject: {} },
        };
      if (name === "../domain/metronome")
        return require("../.test-build/metronome.js");
      if (name === "./ui")
        return {
          Body: "Body",
          Button: ({ title, onPress }) =>
            react.createElement("Pressable", {
              accessibilityLabel: title,
              onPress,
            }),
          colors: {},
          styles: {},
        };
      throw new Error(name);
    },
  });
  const props = {
    value: "4/4",
    onChange: (value) => {
      changes.push(value);
      props.value = value;
    },
    ...overrides,
  };
  function flatten(element) {
    if (!element || typeof element !== "object") return [];
    if (Array.isArray(element)) return element.flatMap(flatten);
    if (typeof element.type === "function")
      return flatten(element.type(element.props));
    return [element, ...flatten(element.props.children)];
  }
  const render = () => flatten(module.exports.TimeSignaturePicker(props));
  const find = (label) =>
    render().find((element) => element.props.accessibilityLabel === label);
  const modal = () => render().find((element) => element.type === "Modal");
  return { props, changes, render, find, modal };
}

test("Meter popup opens, selects one of 36 options and closes without text entry", () => {
  const h = pickerHarness();
  assert.equal(h.modal().props.visible, false);
  h.find("Birama: 4/4").props.onPress();
  assert.equal(h.modal().props.visible, true);
  assert.equal(
    h
      .render()
      .filter((element) =>
        /^Pilih \d+\/(2|4|8)$/.test(element.props.accessibilityLabel),
      ).length,
    36,
  );
  assert.equal(h.find("Pilih 4/4").props.accessibilityState.selected, true);
  h.find("Pilih 12/8").props.onPress();
  assert.deepEqual(h.changes, ["12/8"]);
  assert.equal(h.modal().props.visible, false);
  assert.equal(
    h.render().some((element) => element.type === "TextInput"),
    false,
  );
});

test("Cancel/back/backdrop preserve legacy meter; disabled picker cannot change it", () => {
  const h = pickerHarness({ value: "13/16" });
  h.find("Birama: 13/16").props.onPress();
  h.find("Batal").props.onPress();
  assert.deepEqual(h.changes, []);
  h.find("Birama: 13/16").props.onPress();
  h.modal().props.onRequestClose();
  assert.equal(h.modal().props.visible, false);
  h.find("Birama: 13/16").props.onPress();
  h.find("Tutup pilihan birama").props.onPress();
  assert.deepEqual(h.changes, []);
  h.props.disabled = true;
  assert.equal(h.find("Birama: 13/16").props.disabled, true);
  h.find("Pilih 3/4").props.onPress();
  assert.deepEqual(h.changes, []);
});

test("Optional library/arrangement meters can be explicitly cleared", () => {
  const h = pickerHarness();
  assert.equal(h.find("Belum diatur"), undefined);
  h.props.allowEmpty = true;
  h.find("Belum diatur").props.onPress();
  assert.deepEqual(h.changes, [""]);
  assert.ok(h.find("Birama: Belum dipilih"));
});
