const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  palettes,
  parseThemeMode,
  themeStorageKey,
  ThemePreference,
} = require("../.test-build/theme");

test("Light is the default, invalid stored values never follow the phone theme", async () => {
  for (const value of [null, "", "system", "DARK", "corrupt"])
    assert.equal(parseThemeMode(value), "light");
  assert.equal(parseThemeMode("dark"), "dark");
  const pref = new ThemePreference({
    getItem: async (key) => {
      assert.equal(key, themeStorageKey);
      return "dark";
    },
  });
  assert.equal(await pref.read(), "dark");
  assert.equal(palettes.light.background, "#FFFFFF");
  assert.equal(palettes.light.teal, "#2F6782");
  assert.equal(palettes.dark.teal, "#FF9B45");
});
test("Theme writes survive restarts/account changes and serialize rapid toggles", async () => {
  let value = null;
  const writes = [];
  const storage = {
    async getItem() {
      return value;
    },
    async setItem(key, mode) {
      writes.push(mode);
      await Promise.resolve();
      value = mode;
    },
  };
  const pref = new ThemePreference(storage);
  await Promise.all([pref.save("dark"), pref.save("light"), pref.save("dark")]);
  assert.deepEqual(writes, ["dark", "light", "dark"]);
  assert.equal(await new ThemePreference(storage).read(), "dark");
});
test("Storage failures propagate, do not poison future theme writes", async () => {
  let fail = true,
    value = null;
  const pref = new ThemePreference({
    async getItem() {
      throw Error("read failure");
    },
    async setItem(key, mode) {
      if (fail) throw Error("write failure");
      value = mode;
    },
  });
  await assert.rejects(pref.read(), /read failure/);
  await assert.rejects(pref.save("dark"), /write failure/);
  fail = false;
  await pref.save("light");
  assert.equal(value, "light");
});
