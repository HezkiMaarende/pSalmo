const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../plugins/withWindowsAudioBuild.js"), "utf8");
function loadPlugin() {
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    require(name) {
      assert.equal(name, "@expo/config-plugins");
      return { withAppBuildGradle: (config, action) => action(config) };
    },
  });
  return module.exports;
}
test("Windows native downloader plugin preserves Gradle content and applies exactly once", () => {
  const plugin = loadPlugin();
  const config = { modResults: { language: "groovy", contents: "// Existing project configuration\n" } };
  const once = plugin(config).modResults.contents;
  assert.ok(once.startsWith("// Existing project configuration\n"));
  assert.match(once, /os\.name/);
  assert.match(once, /downloadPrebuiltBinaries/);
  assert.match(once, /download-audio-libs\.ps1/);
  assert.equal(plugin(config).modResults.contents, once);
});
test("Windows native downloader plugin rejects an unsupported Gradle language", () => {
  assert.throws(() => loadPlugin()({ modResults: { language: "kotlin", contents: "" } }), /Groovy/);
});
