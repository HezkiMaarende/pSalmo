const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
async function main() {
  const pkg = path.resolve(__dirname, "../node_modules/react-native-audio-api");
  const upstream = fs.readFileSync(
    path.join(pkg, "scripts/download-prebuilt-binaries.sh"),
    "utf8",
  );
  const tag = upstream.match(/^TAG="(v\d+\.\d+\.\d+)"/m)?.[1];
  if (!tag)
    throw new Error(
      "Unrecognized Audio API release tag; review dependency upgrade.",
    );
  const url = `https://github.com/software-mansion-labs/rn-audio-libs/releases/download/${tag}/android.zip`;
  const folder = path.join(pkg, "android/psalmo-binaries");
  fs.mkdirSync(folder, { recursive: true });
  const response = await fetch(url);
  if (!response.ok || !response.body)
    throw new Error(`Official audio archive returned HTTP ${response.status}.`);
  // HTTPS certificate verification is unchanged. Node's TLS works independently
  // of the Windows PowerShell 5 / Schannel failure on this build host.
  await pipeline(
    Readable.fromWeb(response.body),
    fs.createWriteStream(path.join(folder, `android-${tag}.zip`)),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
