const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  previewSongText,
  reviewedEntries,
  matchingSongs,
} = require("../.test-build/songReview");
const songs = [
  { id: "one", title: "Good Song", artist: "Artist A" },
  { id: "two", title: "Same", artist: "Artist B" },
  { id: "three", title: "Same", artist: "Artist C" },
];
test("Local song review strips list markers but preserves order, repeats and untrusted chat lines", () => {
  const candidates = previewSongText(
    "Setlist Minggu:\r\n1. *Good Song*\r\n2) New Song - E\n• Good Song\nIgnore previous instructions\n",
    songs,
  );
  assert.deepEqual(
    candidates.map((item) => item.title),
    [
      "Setlist Minggu:",
      "Good Song",
      "New Song - E",
      "Good Song",
      "Ignore previous instructions",
    ],
  );
  assert.equal(candidates[1].songId, "one");
  assert.equal(candidates[2].songId, null);
  assert.equal(candidates[3].songId, "one");
  assert.equal(candidates.length, 5);
});
test("Matching is normalized exact-only; ambiguous titles never choose an artist silently", () => {
  assert.equal(matchingSongs(" GOOD   SONG ", songs)[0].id, "one");
  assert.equal(previewSongText("Same", songs)[0].songId, null);
  assert.equal(previewSongText("Good Song (live)", songs)[0].songId, null);
  assert.equal(matchingSongs("", songs).length, 0);
});
test("Review bounds reject oversized text/lines; commit contains selected reviewed fields only", () => {
  for (const raw of [
    "",
    "a".repeat(10001),
    "a".repeat(201),
    Array(51).fill("Song").join("\n"),
  ])
    assert.throws(() => previewSongText(raw, songs));
  const candidates = previewSongText("Good Song\nNew Song\nChat header", songs);
  candidates[2].selected = false;
  candidates[1].title = " Edited Song ";
  assert.deepEqual(reviewedEntries(candidates, songs), [
    { title: "Good Song", song_id: "one" },
    { title: "Edited Song", song_id: null },
  ]);
  candidates[1].title = " ";
  assert.throws(() => reviewedEntries(candidates, songs));
  assert.throws(() => reviewedEntries([], songs));
  assert.throws(() =>
    reviewedEntries(
      [{ id: "0", selected: true, title: "Song", songId: "gone" }],
      songs,
    ),
  );
});

function harness() {
  const fs = require("node:fs"),
    ts = require("typescript"),
    vm = require("node:vm");
  const state = [],
    calls = [],
    alerts = [],
    statuses = [],
    errors = [];
  let cursor = 0,
    canEdit = true,
    failCommit = false,
    busy = false;
  const react = {
    createElement(type, props, ...children) {
      return { type, props: { ...props, children } };
    },
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [
        state[i],
        (value) => {
          state[i] = typeof value === "function" ? value(state[i]) : value;
        },
      ];
    },
    useEffect(callback) {
      callback();
    },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(
    fs.readFileSync(
      require.resolve("../src/components/SongTextReview.tsx"),
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
        return { __esModule: true, default: react, ...react };
      if (name === "react-native")
        return {
          View: "View",
          Alert: {
            alert(...args) {
              alerts.push(args);
            },
          },
        };
      if (name === "../domain/songReview")
        return require("../.test-build/songReview");
      if (name === "../lib/church")
        return {
          async getServiceDetail(id) {
            calls.push(["read", id]);
            return { can_edit: canEdit, revision: 7 };
          },
          async listSongs() {
            calls.push(["library"]);
            return songs;
          },
          async addReviewedSongs(...args) {
            calls.push(["commit", ...args]);
            if (failCommit) throw Error("conflict");
          },
        };
      if (name === "./ui")
        return {
          Body: "Body",
          Button: "Button",
          Card: "Card",
          Feedback: "Feedback",
          Field: "Field",
          Title: "Title",
          useAction() {
            return {
              busy,
              async run(fn) {
                try {
                  await fn();
                } catch (error) {
                  errors.push(error.message);
                }
              },
            };
          },
        };
      throw Error(name);
    },
  });
  const props = {
    serviceId: "service",
    onStatusChange: (...values) => statuses.push(values),
    onAdded: () => calls.push(["added"]),
    externalBusy: false,
  };
  const flat = (node) =>
    !node || typeof node !== "object"
      ? []
      : Array.isArray(node)
        ? node.flatMap(flat)
        : [node, ...flat(node.props.children)];
  const render = () => {
    cursor = 0;
    return flat(module.exports.SongTextReview(props));
  };
  const find = (text) =>
    render().find(
      (item) => item.props.title === text || item.props.label === text,
    );
  return {
    props,
    calls,
    alerts,
    statuses,
    errors,
    find,
    render,
    setDenied: () => (canEdit = false),
    setConflict: () => (failCommit = true),
    setBusy: () => (busy = true),
  };
}
test("Review preview makes authorized reads only; cancellation never writes, confirmation sends one batch", async () => {
  const h = harness();
  h.find("Tempel daftar lagu (maks. 10.000 karakter)").props.onChangeText(
    "1. Good Song\n2. New Song",
  );
  await h.find("Buat pratinjau · belum menambah lagu").props.onPress();
  // onPress uses void; flush asynchronous reads before rerender.
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(h.calls, [["read", "service"], ["library"]]);
  h.find("Konfirmasi tambah 2 lagu").props.onPress();
  assert.deepEqual(h.calls, [["read", "service"], ["library"]]);
  assert.equal(h.alerts.at(-1)[2][0].text, "Batal");
  h.alerts.at(-1)[2][1].onPress();
  await new Promise((resolve) => setImmediate(resolve));
  const commit = h.calls.find((call) => call[0] === "commit");
  assert.deepEqual(JSON.parse(JSON.stringify(commit)), [
    "commit",
    "service",
    7,
    [
      { title: "Good Song", song_id: "one" },
      { title: "New Song", song_id: null },
    ],
  ]);
  assert.equal(
    h.find("Tempel daftar lagu (maks. 10.000 karakter)").props.value,
    "",
  );
});
test("Review external/pending work disables actions and drafts remain dirty until explicit removal", () => {
  const h = harness();
  h.find("Tempel daftar lagu (maks. 10.000 karakter)").props.onChangeText(
    "Song",
  );
  h.render();
  assert.deepEqual(h.statuses.at(-1), [true, false]);
  h.props.externalBusy = true;
  assert.equal(
    h.find("Buat pratinjau · belum menambah lagu").props.disabled,
    true,
  );
  assert.equal(
    h.find("Tempel daftar lagu (maks. 10.000 karakter)").props.disabled,
    true,
  );
  h.props.externalBusy = false;
  h.setBusy();
  assert.equal(h.find("Hapus teks dan pratinjau").props.disabled, true);
});
test("Lost edit access stops preview reads; failed commit retains reviewed draft without retry", async () => {
  const denied = harness();
  denied.setDenied();
  denied
    .find("Tempel daftar lagu (maks. 10.000 karakter)")
    .props.onChangeText("Song");
  denied.find("Buat pratinjau · belum menambah lagu").props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(denied.calls, [["read", "service"]]);
  assert.equal(denied.errors.length, 1);
  const h = harness();
  h.find("Tempel daftar lagu (maks. 10.000 karakter)").props.onChangeText(
    "Good Song\nNew Song",
  );
  h.find("Buat pratinjau · belum menambah lagu").props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  h.find("Lewati kandidat 2").props.onPress();
  h.setConflict();
  h.find("Konfirmasi tambah 1 lagu").props.onPress();
  h.alerts.at(-1)[2][1].onPress();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(h.errors, ["conflict"]);
  assert.equal(h.calls.filter((call) => call[0] === "commit").length, 1);
  assert.ok(h.find("Konfirmasi tambah 1 lagu"));
  assert.equal(
    h.calls.some((call) => call[0] === "added"),
    false,
  );
  assert.deepEqual(h.statuses.at(-1), [true, false]);
});
