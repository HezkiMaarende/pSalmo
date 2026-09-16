const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(
  path.join(__dirname, "../plugins/withWindowsAudioBuild.js"),
  "utf8",
);
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
  const config = {
    modResults: {
      language: "groovy",
      contents: "// Existing project configuration\n",
    },
  };
  const once = plugin(config).modResults.contents;
  assert.ok(once.startsWith("// Existing project configuration\n"));
  assert.match(once, /os\.name/);
  assert.match(once, /downloadPrebuiltBinaries/);
  assert.match(once, /download-audio-libs\.ps1/);
  assert.match(once, /finalizeDsl/);
  assert.match(once, /buildStagingDirectory/);
  assert.match(once, /'\.cxx\/a'/);
  assert.equal(plugin(config).modResults.contents, once);
});
test("Windows CMake staging upgrades an existing downloader-only prebuild exactly once", () => {
  const plugin = loadPlugin();
  const existing =
    "// pSalmo: Windows Audio API native-library downloader\n// Existing downloader remains intact\n";
  const config = { modResults: { language: "groovy", contents: existing } };
  const result = plugin(config).modResults.contents;
  assert.ok(result.startsWith(existing));
  assert.equal(
    (result.match(/Windows Audio API native-library downloader/g) || []).length,
    1,
  );
  assert.equal(
    (result.match(/Windows Audio API short CMake staging/g) || []).length,
    1,
  );
  assert.equal(plugin(config).modResults.contents, result);
});
test("Windows native downloader plugin rejects an unsupported Gradle language", () => {
  assert.throws(
    () => loadPlugin()({ modResults: { language: "kotlin", contents: "" } }),
    /Groovy/,
  );
});
