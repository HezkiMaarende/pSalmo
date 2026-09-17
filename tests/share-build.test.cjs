const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validateShareConfig } = require("../scripts/validate-share-config.cjs");
const config = {
  EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  EXPO_PUBLIC_CHURCH_TEAM_ID: "12345678-1234-1234-1234-123456789abc",
};
const jwt = (role) =>
  `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;

test("Share config accepts publishable and legacy anon keys without loading local secrets", () => {
  assert.doesNotThrow(() => validateShareConfig(config));
  assert.doesNotThrow(() =>
    validateShareConfig({
      ...config,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt("anon"),
    }),
  );
});
test("Share config rejects privileged keys, user tokens and malformed configuration", () => {
  for (const key of [
    "",
    "sb_secret_example",
    jwt("service_role"),
    jwt("authenticated"),
    "bad.jwt.payload",
  ])
    assert.throws(() =>
      validateShareConfig({
        ...config,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
      }),
    );
  for (const url of [undefined, "", "http://example.supabase.co"])
    assert.throws(() =>
      validateShareConfig({ ...config, EXPO_PUBLIC_SUPABASE_URL: url }),
    );
  assert.throws(() =>
    validateShareConfig({ ...config, EXPO_PUBLIC_CHURCH_TEAM_ID: "wrong" }),
  );
  assert.throws(
    () =>
      validateShareConfig({
        ...config,
        EXPO_PUBLIC_SERVICE_ROLE_KEY: "private-value",
      }),
    /privileged/,
  );
});
test("Share command builds all supported ABIs as release and verifies before publishing", () => {
  const pkg = require("../package.json");
  assert.match(
    pkg.scripts["build:share"],
    /-Variant preview -Architecture universal/,
  );
  const build = fs.readFileSync(
    path.join(__dirname, "../scripts/build-android.ps1"),
    "utf8",
  );
  assert.match(build, /\$Variant = 'development'/);
  assert.match(build, /arm64-v8a,armeabi-v7a,x86_64/);
  assert.match(build, /:app:assembleRelease/);
  assert.ok(
    build.indexOf("verify-share-apk.ps1") <
      build.indexOf("Copy-Item -LiteralPath $taskApk"),
  );
  assert.match(build, /if \(!\$taskPreview\)/);
  const verify = fs.readFileSync(
    path.join(__dirname, "../scripts/verify-share-apk.ps1"),
    "utf8",
  );
  for (const guard of [
    "application-debuggable",
    "apksigner.bat",
    "assets/index.android.bundle",
    "com.paw.psalmo",
    "native-code:",
  ])
    assert.ok(verify.includes(guard));
});
