const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript");
const domain = require("../.test-build/libraryImport");
const utf8 = (value) => new Uint8Array(Buffer.from(value));
test("Android picker builds block and verify broad storage permissions", () => {
  const config = JSON.parse(fs.readFileSync("app.json", "utf8"));
  for (const name of [
    "READ_EXTERNAL_STORAGE",
    "WRITE_EXTERNAL_STORAGE",
    "MANAGE_EXTERNAL_STORAGE",
  ]) {
    assert.ok(
      config.expo.android.blockedPermissions.includes(
        "android.permission." + name,
      ),
    );
  }
  const build = fs.readFileSync("scripts/build-android.ps1", "utf8");
  assert.ok(
    build.indexOf("scripts/verify-storage-permissions.ps1") <
      build.indexOf("Copy-Item -LiteralPath $taskApk"),
  );
  const guard = fs.readFileSync(
    "scripts/verify-storage-permissions.ps1",
    "utf8",
  );
  assert.match(guard, /dump permissions/);
  assert.match(
    guard,
    /READ_EXTERNAL_STORAGE\|WRITE_EXTERNAL_STORAGE\|MANAGE_EXTERNAL_STORAGE/,
  );
});
const candidate = (title = "Lagu") =>
  domain.candidateFromFile(
    title + ".txt",
    utf8("[Verse]\r\nKasih Tuhan\n\n[Chorus]\nKasih Tuhan\nKasih Tuhan"),
    title,
  );
test("Importer decodes UTF8/BOM and UTF16 LE/BE without changing sections or repeats", () => {
  const text = "[Verse]\nKasih, áé — Tuhan 🙏\n\n[Chorus]\nKasih\nKasih";
  const le = Buffer.concat([
    Buffer.from([255, 254]),
    Buffer.from(text, "utf16le"),
  ]);
  const be = Buffer.concat([
    Buffer.from([254, 255]),
    Buffer.from(text, "utf16le").swap16(),
  ]);
  for (const bytes of [
    utf8(text),
    new Uint8Array(
      Buffer.concat([Buffer.from([239, 187, 191]), Buffer.from(text)]),
    ),
    new Uint8Array(le),
    new Uint8Array(be),
  ])
    assert.equal(domain.decodeSongText(bytes), text);
  assert.equal(
    candidate().lyrics,
    "[Verse]\nKasih Tuhan\n\n[Chorus]\nKasih Tuhan\nKasih Tuhan",
  );
  assert.equal(candidate().time_signature, "4/4");
  assert.equal(candidate().bpm, "");
  assert.equal(candidate().key, "");
});
test("Importer rejects malformed UTF8/UTF16, binary, blank and unsupported files", () => {
  for (const bytes of [
    [0],
    [0xc0, 0xaf],
    [0xe2, 0x82],
    [0xed, 0xa0, 0x80],
    [0xf4, 0x90, 0x80, 0x80],
    [255, 254, 0],
    [255, 254, 0, 0xd8],
    [254, 255, 0xdc, 0],
    [127],
    [32, 10],
  ])
    assert.throws(() => domain.decodeSongText(new Uint8Array(bytes)));
  for (const name of ["file.pro", "../Lagu.txt", "dir\\Lagu.txt"])
    assert.throws(() => domain.candidateFromFile(name, utf8("Lagu"), "id"));
  assert.throws(() =>
    domain.candidateFromFile("Lagu.txt", new Uint8Array(102401), "id"),
  );
});
test("File limits enforce count, per-file and cumulative actual bytes", () => {
  domain.assertFileBounds([102400]);
  domain.assertFileBounds(Array(20).fill(102400));
  for (const sizes of [
    [],
    Array(51).fill(1),
    [0],
    [-1],
    [NaN],
    [102401],
    Array(21).fill(102400),
  ])
    assert.throws(() => domain.assertFileBounds(sizes));
});
test("Duplicate identity normalizes case/whitespace/null artist while preserving different artists", () => {
  const a = candidate("Lagu"),
    b = candidate(" LAGU ");
  b.id = "second";
  assert.deepEqual([...domain.duplicateCandidates([a, b], [])], ["second"]);
  assert.deepEqual(
    [
      ...domain.duplicateCandidates(
        [a],
        [{ id: "old", title: " LAGU ", artist: null }],
      ),
    ],
    [a.id],
  );
  b.artist = "Other Artist";
  assert.equal(domain.duplicateCandidates([a, b], []).size, 0);
  assert.equal(
    domain.identityKey(" LAGU\u00a0  Cinta ", null),
    domain.identityKey("lagu cinta", ""),
  );
});
test("Reviewed payload requires permission and valid fields, preserves lyrics and never guesses BPM", () => {
  const a = candidate(),
    b = candidate("Skip");
  b.selected = false;
  const entries = domain.importEntries([a, b], "Church permission");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].lyrics, a.lyrics);
  assert.equal(entries[0].bpm, null);
  for (const values of [
    { title: " " },
    { bpm: "19" },
    { bpm: "90.5" },
    { time_signature: "13/4" },
    { lyrics: " " },
    { key: "a".repeat(21) },
  ])
    assert.throws(() =>
      domain.importEntries([{ ...a, ...values }], "Permission"),
    );
  assert.throws(() => domain.importEntries([a], " "));
  assert.throws(() => domain.importEntries([], "Permission"));
  assert.equal(
    domain.importEntries(
      [{ ...a, bpm: "90", key: "E", time_signature: "6/8" }],
      "Permission",
    )[0].bpm,
    90,
  );
});
function load(file, requireFn) {
  const module = { exports: {} };
  const source = ts.transpileModule(
    fs.readFileSync(require.resolve("../" + file), "utf8"),
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
    require: requireFn,
    process: { env: { EXPO_PUBLIC_CHURCH_TEAM_ID: "fixture-church" } },
  });
  return module.exports;
}
test("Picker cancel reads/deletes nothing; owned cache only is cleaned on success and failure", async () => {
  let canceled = true,
    assetName = "Lagu.txt";
  const reads = [],
    deleted = [];
  const cache = "file:///cache/DocumentPicker/copy.txt",
    external = "content://provider/source.txt";
  const picker = load("src/lib/libraryImportFiles.ts", (name) => {
    if (name === "../domain/libraryImport") return domain;
    if (name === "expo-document-picker")
      return {
        async getDocumentAsync(options) {
          assert.equal(options.multiple, true);
          assert.equal(options.copyToCacheDirectory, true);
          return canceled
            ? { canceled: true }
            : {
                canceled: false,
                assets: [
                  { name: assetName, uri: cache },
                  { name: "Other.txt", uri: external },
                ],
              };
        },
      };
    if (name === "expo-file-system")
      return {
        Paths: { cache: { uri: "file:///cache" } },
        File: class {
          constructor(uri) {
            this.uri = uri;
          }
          get size() {
            return 4;
          }
          get exists() {
            return true;
          }
          async bytes() {
            reads.push(this.uri);
            return utf8("Lagu");
          }
          delete() {
            deleted.push(this.uri);
          }
        },
      };
    throw Error(name);
  });
  assert.equal(await picker.pickLibraryTextFiles(), null);
  assert.equal(reads.length, 0);
  assert.equal(deleted.length, 0);
  canceled = false;
  const result = await picker.pickLibraryTextFiles();
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(deleted, [cache]);
  assetName = "Unsupported.pro";
  await assert.rejects(picker.pickLibraryTextFiles(), /\.txt/);
  assert.deepEqual(deleted, [cache, cache]);
});
test("Missing native picker is a handled lazy-load rejection, not an app-start import", async () => {
  let attempts = 0;
  const picker = load("src/lib/libraryImportFiles.ts", (name) => {
    if (name === "../domain/libraryImport") return domain;
    attempts++;
    throw Error("Rebuild native picker");
  });
  assert.equal(attempts, 0);
  await assert.rejects(picker.pickLibraryTextFiles(), /Rebuild/);
});
test("Import API sends one RPC; summary pagination excludes lyrics and crosses row cap", async () => {
  const calls = [];
  let page = 0;
  const chain = {
    select(fields) {
      assert.equal(fields, "id,title,artist");
      return this;
    },
    eq() {
      return this;
    },
    order() {
      return this;
    },
    async range(a, b) {
      assert.equal(a, page * 500);
      assert.equal(b, a + 499);
      return {
        data: Array(page++ === 0 ? 500 : 1).fill({
          id: "id",
          title: "Title",
          artist: null,
        }),
        error: null,
      };
    },
  };
  const api = load("src/lib/church.ts", (name) => {
    if (name === "./supabase")
      return {
        supabase: {
          from(table) {
            assert.equal(table, "songs");
            return chain;
          },
          async rpc(...args) {
            calls.push(args);
            return { data: { created: [], skipped: [] }, error: null };
          },
        },
      };
    if (name === "../domain/youtube") return { youtubeId: () => null };
    if (name === "../domain/metronome") return { defaultMeter: () => "4/4" };
    if (name === "../domain/songLabel") return { requiredSongTitle: (v) => v };
    throw Error(name);
  });
  assert.equal((await api.listSongIdentities()).length, 501);
  await api.importLibrarySongs(
    "batch",
    " Permission ",
    domain.importEntries([candidate()], "Permission"),
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "import_library_songs");
  assert.equal(calls[0][1].batch_id, "batch");
  assert.equal(calls[0][1].permission_note, "Permission");
});
test("Import route, permissions, frozen retry and leave guards do not affect metronome", () => {
  const read = (p) => fs.readFileSync(require.resolve("../" + p), "utf8");
  const screen = read("src/screens/LibraryImportScreen.tsx");
  assert.match(screen, /membership.song_editor/);
  assert.match(screen, /usePreventRemove\(dirty \|\| action.busy/);
  assert.match(screen, /action.busy \|\| !!confirmed \|\| !authorized/);
  assert.match(screen, /commit\(confirmed\)/);
  assert.match(
    read("src/screens/LibraryScreens.tsx"),
    /Import dari ProPresenter/,
  );
  assert.match(read("src/navigation/AppNavigator.tsx"), /name="LibraryImport"/);
  assert.doesNotMatch(screen, /useClickPlayer|\.stop\(/);
});
test("Import screen previews locally, defaults duplicate skip, freezes failed confirmation and retries identical batch", async () => {
  const state = [],
    calls = [],
    alerts = [],
    errors = [],
    guards = [];
  let cursor = 0,
    busy = false,
    fail = true;
  const react = {
    createElement(type, props, ...children) {
      return { type, props: { ...props, children } };
    },
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [
        state[i],
        (value) =>
          (state[i] = typeof value === "function" ? value(state[i]) : value),
      ];
    },
  };
  const membership = { role: "member", song_editor: true };
  const screen = load("src/screens/LibraryImportScreen.tsx", (name) => {
    if (name === "react") return { __esModule: true, default: react, ...react };
    if (name === "react-native")
      return {
        View: "View",
        Alert: {
          alert(...args) {
            alerts.push(args);
          },
        },
      };
    if (name === "@react-navigation/native")
      return {
        usePreventRemove(enabled, callback) {
          guards.push({ enabled, callback });
        },
      };
    if (name === "expo-crypto") return { randomUUID: () => "frozen-batch" };
    if (name === "../context/ChurchContext")
      return { useChurch: () => ({ membership }) };
    if (name === "../lib/libraryImportFiles")
      return {
        async pickLibraryTextFiles() {
          calls.push(["pick"]);
          return {
            candidates: [candidate(), candidate("Existing")],
            cleanupWarning: "",
          };
        },
      };
    if (name === "../domain/libraryImport") return domain;
    if (name === "../lib/church")
      return {
        async listSongIdentities() {
          calls.push(["read"]);
          return [{ id: "old", title: "Existing", artist: null }];
        },
        async importLibrarySongs(...args) {
          calls.push(["commit", ...args]);
          if (fail) throw Error("Network response lost");
          return {
            created: [
              { id: "new", title: "Lagu", source_filename: "Lagu.txt" },
            ],
            skipped: [],
          };
        },
      };
    if (name === "../components/TimeSignaturePicker")
      return { TimeSignaturePicker: "Meter" };
    if (name === "../components/ui")
      return {
        Body: "Body",
        Button: "Button",
        Card: "Card",
        Feedback: "Feedback",
        Field: "Field",
        Page: "Page",
        Title: "Title",
        useAction() {
          return {
            busy,
            error: errors.at(-1) || "",
            async run(fn) {
              if (busy) return;
              busy = true;
              try {
                await fn();
              } catch (error) {
                errors.push(error.message);
              } finally {
                busy = false;
              }
            },
          };
        },
      };
    throw Error(name);
  });
  const navigation = {
    navigate: (...args) => calls.push(["navigate", ...args]),
    dispatch: () => {},
  };
  const flat = (node) =>
    !node || typeof node !== "object"
      ? []
      : Array.isArray(node)
        ? node.flatMap(flat)
        : [node, ...flat(node.props.children)];
  const render = () => {
    cursor = 0;
    return flat(screen.LibraryImportScreen({ navigation }));
  };
  const find = (label) =>
    render().find(
      (node) => node.props.label === label || node.props.title === label,
    );
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  find("Pilih .txt / .pro / .propresenter · maksimal 50").props.onPress();
  await flush();
  assert.deepEqual(calls, [["pick"], ["read"]]);
  assert.equal(find("Pilih file 2").props.disabled, true);
  find("Dasar izin penyimpanan dan berbagi lirik").props.onChangeText(
    "Church permission",
  );
  find("Konfirmasi import 1 lagu baru").props.onPress();
  await flush();
  assert.equal(calls.filter((call) => call[0] === "commit").length, 0);
  alerts.at(-1)[2][1].onPress();
  await flush();
  const first = calls.find((call) => call[0] === "commit");
  assert.equal(first[1], "frozen-batch");
  assert.equal(first[3].length, 1);
  assert.equal(
    find("Dasar izin penyimpanan dan berbagi lirik").props.disabled,
    true,
  );
  assert.equal(guards.at(-1).enabled, true);
  membership.song_editor = false;
  assert.equal(find("Coba ulang batch yang sama").props.disabled, true);
  membership.song_editor = true;
  fail = false;
  find("Coba ulang batch yang sama").props.onPress();
  await flush();
  assert.deepEqual(calls.filter((call) => call[0] === "commit")[1], first);
  assert.equal(guards.at(-1).enabled, true); // previous render; update below
  find("Lihat Lagu").props.onPress();
  assert.equal(guards.at(-1).enabled, false);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), [
    "navigate",
    "Song",
    { id: "new" },
  ]);
});
