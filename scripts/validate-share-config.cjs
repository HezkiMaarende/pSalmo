function validateShareConfig(env) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const church = env.EXPO_PUBLIC_CHURCH_TEAM_ID;
  try {
    if (new URL(url).protocol !== "https:") throw Error();
  } catch {
    throw Error(
      "Set EXPO_PUBLIC_SUPABASE_URL to the HTTPS Supabase project URL.",
    );
  }
  if (!key) throw Error("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.");
  // An anon JWT is a legacy public key, not a signed-in user's access token.
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!publicKey && key.split(".").length === 3) {
    try {
      publicKey =
        JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"))
          .role === "anon";
    } catch {}
  }
  if (!publicKey)
    throw Error(
      "Only a Supabase publishable key or legacy anon key may be bundled. Never use a secret/service-role/user-session key.",
    );
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      church || "",
    )
  )
    throw Error(
      "Set EXPO_PUBLIC_CHURCH_TEAM_ID to the configured church UUID.",
    );
  for (const name of Object.keys(env)) {
    if (
      name.startsWith("EXPO_PUBLIC_") &&
      /SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN/i.test(name)
    )
      throw Error(
        "Remove privileged EXPO_PUBLIC configuration before sharing an APK.",
      );
  }
}
module.exports = { validateShareConfig };
if (require.main === module) {
  try {
    require("@expo/env").load(require("node:path").resolve(__dirname, ".."), {
      silent: true,
      force: true,
    });
    validateShareConfig(process.env);
    console.log(
      "Public Supabase/church configuration validated; no key values printed.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
