const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

function harness(storage) {
  const slots = [],
    effects = [],
    appearances = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({
      type,
      props: { ...props, children },
    }),
    createContext: () => ({ Provider: "ThemeProvider" }),
    useContext: () => {},
    useCallback: (fn) => fn,
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [
        slots[i],
        (value) => {
          slots[i] = value;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((value, j) => value !== slots[i][j])) {
        slots[i] = deps;
        effects.push(fn);
      }
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(
        require.resolve("../src/context/ThemeContext.tsx"),
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
    ).outputText,
    {
      module,
      exports: module.exports,
      require(name) {
        if (name === "react")
          return { __esModule: true, default: react, ...react };
        if (name === "react-native")
          return {
            View: "View",
            ActivityIndicator: "Loading",
            Appearance: { setColorScheme: (value) => appearances.push(value) },
          };
        if (name === "@react-native-async-storage/async-storage")
          return { __esModule: true, default: storage };
        if (name === "expo-system-ui")
          return { setBackgroundColorAsync: async () => {} };
        if (name === "../domain/theme") return require("../.test-build/theme");
        throw Error(name);
      },
    },
  );
  const children = {
    navigation: { draft: "unsaved" },
    player: { active: true },
  };
  return {
    children,
    appearances,
    render() {
      cursor = 0;
      const tree = module.exports.ThemeProvider({ children });
      while (effects.length) effects.shift()();
      return tree;
    },
  };
}
test("Theme hydrates before mounting navigation; toggling keeps child identity and session mode after failed save", async () => {
  let release;
  const h = harness({
    getItem: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    async setItem() {
      throw Error("disk failure");
    },
  });
  assert.equal(h.render().type, "View");
  release("dark");
  await settle();
  let tree = h.render();
  assert.equal(tree.type, "ThemeProvider");
  assert.equal(tree.props.value.mode, "dark");
  assert.equal(tree.props.children[0], h.children);
  tree.props.value.setMode("light");
  tree = h.render();
  assert.equal(tree.props.value.mode, "light");
  assert.equal(tree.props.children[0], h.children);
  await settle();
  tree = h.render();
  assert.equal(tree.props.value.mode, "light");
  assert.match(tree.props.value.storageError, /gagal disimpan/);
  assert.deepEqual(h.appearances, ["dark", "light"]);
  assert.equal(h.children.navigation.draft, "unsaved");
  assert.equal(h.children.player.active, true);
});
test("Unreadable theme preference falls back to Light and exposes the read error", async () => {
  const h = harness({
    async getItem() {
      throw Error("disk failure");
    },
    async setItem() {},
  });
  h.render();
  await settle();
  const tree = h.render();
  assert.equal(tree.props.value.mode, "light");
  assert.match(tree.props.value.storageError, /tidak dapat dibaca/);
  assert.deepEqual(h.appearances, ["light"]);
});
