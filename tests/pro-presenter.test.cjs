const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const {
  rtfToLyrics,
  parseProPresenterLyrics,
  parseProPresenterFile,
} = require("../.test-build/proPresenter");
const library = require("../.test-build/libraryImport");
const b = (x) => Buffer.from(x, "utf8");
function varint(value) {
  const bytes = [];
  do {
    let byte = value % 128;
    value = Math.floor(value / 128);
    bytes.push(byte + (value ? 128 : 0));
  } while (value);
  return Buffer.from(bytes);
}
const field = (id, payload) =>
  Buffer.concat([varint(id * 8 + 2), varint(payload.length), payload]);
const number = (id, value) => Buffer.concat([varint(id * 8), varint(value)]);
const message = (...fields) => Buffer.concat(fields);
const uuid = (id) => field(1, b(id));
const rtf = (text) => String.raw`{\rtf0\ansi\ansicpg1252 ${text}}`;
function element(text, { hidden = false, dynamic = false } = {}) {
  const graphic = message(
    field(13, field(5, b(text))),
    hidden ? number(16, 1) : Buffer.alloc(0),
  );
  return field(
    1,
    message(
      field(1, graphic),
      dynamic ? field(6, field(14, Buffer.alloc(0))) : Buffer.alloc(0),
    ),
  );
}
const action = (elements, notes) =>
  field(
    10,
    message(
      number(9, 11),
      field(
        23,
        field(
          2,
          message(
            field(1, message(...elements)),
            notes ? field(2, field(1, b(notes))) : Buffer.alloc(0),
          ),
        ),
      ),
    ),
  );
const cue = (id, elements, notes) =>
  field(13, message(field(1, uuid(id)), action(elements, notes)));
const group = (name, ids) =>
  field(
    12,
    message(
      field(1, field(2, b(name))),
      ...ids.map((id) => field(2, uuid(id))),
    ),
  );
const sample = () =>
  message(
    field(3, b("Presentation")),
    cue(
      "verse",
      [
        element(rtf(String.raw` Kasih Tuhan\par Kasih Tuhan `)),
        element(rtf(String.raw`\cb3 Kasih Tuhan\par Kasih Tuhan`)),
      ],
      rtf("DO NOT IMPORT NOTES"),
    ),
    cue("chorus", [
      element(rtf("Haleluya")),
      element(rtf("Hidden"), { hidden: true }),
      element(rtf("Copyright link"), { dynamic: true }),
    ]),
    group("Verse 1", ["verse"]),
    group("Chorus", ["chorus"]),
    group("Chorus repeat", ["chorus"]),
    field(
      14,
      message(
        field(1, b("Writer asli")),
        field(2, b("Artist asli")),
        field(4, b("Publisher asli")),
        number(5, 2026),
      ),
    ),
  );
test("RTF removes nested font/colors/metadata/style while preserving paragraphs and repeated lines", () => {
  assert.equal(
    rtfToLyrics(
      String.raw`{\rtf1\ansi{\fonttbl{\f0 Arial;}}{\colortbl;\red255\green0\blue0;}{\info{\title Private}}{\*\unknown UUID noise}\f0\cb3\fs36 Kasih\par Kasih\line Tuhan{\b  baik}\par -\par 12345678-1234-1234-1234-123456789abc}`,
    ),
    "Kasih\nKasih\nTuhan baik",
  );
});
test("RTF escaped literals, typography, Unicode signed surrogates and uc-scoped fallback", () => {
  assert.equal(
    rtfToLyrics(
      String.raw`{\rtf0 \{Kasih\}\tab \\ \u233?{\uc0\u233}\u233?\par \u-10179?\u-8704?\emdash Tuhan}`,
    ),
    "{Kasih}\t\\ ééé\n😀—Tuhan",
  );
  assert.equal(
    rtfToLyrics(String.raw`{\rtf1 {\upr{ANSI fallback}{\*\ud Unicode\u233?}}}`),
    "Unicodeé",
  );
  assert.equal(rtfToLyrics(String.raw`{\rtf1 A{\v Hidden}\v0 B}`), "AB");
});
test("RTF bytes support declared CP1252, Latin1 and UTF8 without replacing malformed bytes", () => {
  assert.equal(rtfToLyrics("{\\rtf0\\ansicpg65001 Kasih é 🙏}"), "Kasih é 🙏");
  assert.equal(
    rtfToLyrics(String.raw`{\rtf0\ansi\ansicpg1252 B\'e9\'91\'92}`),
    "Bé‘’",
  );
  assert.equal(
    rtfToLyrics(Buffer.from("{\\rtf0\\ansicpg28591 B\xe9}", "latin1")),
    "Bé",
  );
  assert.equal(
    rtfToLyrics(b("{\\rtf0\\ansicpg65001 Kasih é 🙏}")),
    "Kasih é 🙏",
  );
  assert.throws(
    () => rtfToLyrics(String.raw`{\rtf0\ansicpg932 \'82\'a0}`),
    /code page/,
  );
  assert.throws(() =>
    rtfToLyrics(
      Buffer.concat([
        b("{\\rtf0\\ansicpg65001 "),
        Buffer.from([0xc0, 0xaf]),
        b("}"),
      ]),
    ),
  );
});
test("RTF artifact cleanup cannot crash engines without Unicode property escapes or erase non-Latin letters", () => {
  const module = { exports: {} };
  class LegacyRegExp extends RegExp {
    constructor(pattern, flags) {
      if (String(pattern).includes("\\p{"))
        throw new SyntaxError("Unsupported Unicode escape");
      super(pattern, flags);
    }
  }
  vm.runInNewContext(fs.readFileSync(".test-build/proPresenter.js", "utf8"), {
    exports: module.exports,
    RegExp: LegacyRegExp,
  });
  assert.equal(
    module.exports.rtfToLyrics("{\\rtf0 Ω\\par 中\\par -}"),
    "Ω\n中",
  );
  assert.ok(
    !fs.readFileSync("src/domain/proPresenter.ts", "utf8").includes("(?<!"),
  );
});
test("ProPresenter-style expanded colors/list metadata and empty notes need no generated schema or style stripping regex", () => {
  const metadata = String.raw`{\fonttbl\f0\fnil FixtureDisplay-Black;}{\colortbl;\red253\green253\blue253;\red0\green0\blue0;}{\*\expandedcolortbl;\csgenericrgb\c99215\c99215\c99215\c100000;}{\*\listtable}{\*\listoverridetable}`;
  const paragraph = String.raw`\pard\li0\fi0\ri0\qc\sb0\sa0\sl240\slmult1\slleading0\f0\b0\i0\ul0\strike0\fs240\expnd0\expndtw0\cf1\strokewidth60\strokec2\nosupersub\ulc0\highlight3\cb3 `;
  assert.equal(
    rtfToLyrics(
      String.raw`{\rtf0\ansi\ansicpg1252${metadata}\uc1\paperw38400\margl0\margr0${paragraph}Fixture first\par${paragraph}Fixture second}`,
    ),
    "Fixture first\nFixture second",
  );
  assert.equal(
    rtfToLyrics(String.raw`{\rtf0\ansi\ansicpg1252${metadata}${paragraph}}`),
    "",
  );
});
test("Binary RTF destinations are skipped by exact byte length; Unicode alternatives are not duplicated", () => {
  assert.equal(rtfToLyrics(String.raw`{\rtf0 A{\pict\bin4 {x}q}B}`), "AB");
  assert.equal(
    rtfToLyrics(
      String.raw`{\rtf0 A{\*\custom {\upr{noise}{\*\ud not visible}}}B}`,
    ),
    "AB",
  );
});
test("Corrupt/truncated RTF, controls, bad Unicode and excessive nesting fail explicitly", () => {
  for (const text of [
    "",
    "not rtf",
    "{\\rtf0 text",
    "{\\rtf0 text}noise",
    String.raw`{\rtf0 \'zz}`,
    String.raw`{\rtf0\bin999 x}`,
    String.raw`{\rtf0\uc99 x}`,
    String.raw`{\rtf0\u-10179?}`,
    String.raw`{\rtf0\u-8704?}`,
    "{\\rtf0\u0000}",
    "{\\rtf0" + "{".repeat(64) + "x" + "}".repeat(65),
    String.raw`{\rtf0{\upr{only one}}}`,
  ])
    assert.throws(() => rtfToLyrics(text), text);
});
test("Schema-directed PP7 import orders actual sections; same-cue layer duplicates only, never repeated slides/lyrics", () => {
  const bytes = sample(),
    parsed = parseProPresenterFile(bytes);
  assert.equal(
    parsed.lyrics,
    "[Verse 1]\nKasih Tuhan\nKasih Tuhan\n\n[Chorus]\nHaleluya\n\n[Chorus repeat]\nHaleluya",
  );
  assert.equal(parsed.artist, "Artist asli");
  assert.equal(parsed.writer_credits, "Writer asli");
  assert.equal(parsed.copyright_notice, "2026 · Publisher asli");
  assert.equal(parsed.warnings.length, 2);
  assert.equal(parseProPresenterLyrics(bytes), parsed.lyrics);
  assert.equal(
    parseProPresenterLyrics(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ),
    parsed.lyrics,
  );
});
test("Unknown protobuf metadata RTF and slide notes never become lyrics; ungrouped slides retain separators", () => {
  const bytes = message(
    field(7, b(rtf("PRIVATE NOTES"))),
    cue("one", [element(rtf("Kasih"))], rtf("SLIDE NOTES")),
    cue("two", [element(rtf("Kasih"))]),
  );
  assert.equal(parseProPresenterLyrics(bytes), "Kasih\n\nKasih");
  assert.throws(() =>
    parseProPresenterLyrics(message(field(7, b(rtf("NOT LYRICS"))))),
  );
  assert.throws(() =>
    parseProPresenterLyrics(message(cue("one", [element(rtf(""))]))),
  );
});
test("Protobuf corruption, unsupported formats, missing refs, duplicate cue IDs and limits are rejected", () => {
  for (const bytes of [
    Buffer.alloc(0),
    b("<xml/>"),
    b("PKbundle"),
    Buffer.from([0]),
    Buffer.from([0x6a, 0xff, 0xff, 0xff, 0x7f]),
    sample().subarray(0, sample().length - 1),
    message(cue("a", [element(rtf("A"))]), group("Verse", ["missing"])),
    message(cue("a", [element(rtf("A"))]), cue("a", [element(rtf("B"))])),
    Buffer.alloc(102401),
  ])
    assert.throws(() => parseProPresenterFile(bytes));
  assert.throws(() => parseProPresenterFile(null));
});
test("Native candidates keep editable filename title/CCLI attribution, defaults, warnings and reviewed payload shape", () => {
  for (const extension of ["pro", "propresenter", "PRO"]) {
    const draft = library.candidateFromFile(
      "Song." + extension,
      sample(),
      "id",
    );
    assert.equal(draft.title, "Song");
    assert.equal(draft.time_signature, "4/4");
    assert.equal(draft.key, "");
    assert.equal(draft.bpm, "");
    assert.equal(draft.artist, "Artist asli");
    assert.equal(draft.writer_credits, "Writer asli");
    const entry = library.importEntries([draft], "Church permission")[0];
    assert.equal(entry.source_filename, "Song." + extension);
    assert.equal(entry.lyrics, draft.lyrics);
    assert.ok(!("parse_warnings" in entry));
  }
  assert.throws(() =>
    library.candidateFromFile("Song.proBundle", sample(), "id"),
  );
  assert.throws(() => library.candidateFromFile("Song.pro6", sample(), "id"));
  assert.throws(() =>
    library.candidateFromFile("Song.propresenter", b("<xml/>"), "id"),
  );
});
