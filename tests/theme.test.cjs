const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  palettes,
  parseThemeMode,
  themeStorageKey,
  ThemePreference,
} = require("../.test-build/theme");

test("Both palettes keep normal text and primary-button contrast above 4.5:1", () => {
  const luminance = (hex) => {
    const values = hex
      .slice(1)
      .match(/../g)
      .map((value) => parseInt(value, 16) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  };
  const contrast = (a, b) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) /
    (Math.min(luminance(a), luminance(b)) + 0.05);
  for (const colors of Object.values(palettes)) {
    assert.ok(contrast(colors.ink, colors.background) >= 4.5);
    assert.ok(contrast(colors.muted, colors.surface) >= 4.5);
    assert.ok(contrast(colors.onAccent, colors.teal) >= 4.5);
    assert.ok(contrast("#FFFFFF", colors.transport) >= 4.5);
  }
});

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
