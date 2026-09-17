/** Read-only PP7 subset. Field paths verified against ProPresenter7-Proto;
 * see docs/propresenter-native.md. No Node Buffer/TextDecoder/native dependency.
 */
const MAX_BYTES = 100 * 1024;
const MAX_FIELDS = 20000;
// Some bundled Hermes versions lack Unicode property escapes. Construct them
// defensively, never as syntax that can prevent the whole app from loading.
const ALPHANUMERIC = (() => {
  try {
    return new RegExp("[\\p{L}\\p{N}]", "u");
  } catch {
    return null;
  }
})();
function singleArtifact(line: string): boolean {
  if (Array.from(line).length !== 1) return false;
  return ALPHANUMERIC
    ? !ALPHANUMERIC.test(line)
    : /^[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e•…–—]$/.test(line);
}
const bad = (detail: string): never => {
  throw Error(
    `File ProPresenter/RTF tidak didukung atau rusak: ${detail}. Ekspor .txt sebagai alternatif.`,
  );
};
function utf8(bytes: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; ) {
    const a = bytes[i++];
    if (a < 128) {
      out.push(String.fromCharCode(a));
      continue;
    }
    let count: number, value: number, min: number;
    if (a >= 194 && a <= 223) {
      count = 1;
      value = a & 31;
      min = 128;
    } else if (a >= 224 && a <= 239) {
      count = 2;
      value = a & 15;
      min = 2048;
    } else if (a >= 240 && a <= 244) {
      count = 3;
      value = a & 7;
      min = 65536;
    } else return bad("UTF-8");
    if (i + count > bytes.length) return bad("UTF-8 terpotong");
    while (count--) {
      const b = bytes[i++];
      if ((b & 192) !== 128) return bad("UTF-8");
      value = (value << 6) | (b & 63);
    }
    if (value < min || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff))
      return bad("Unicode");
    out.push(String.fromCodePoint(value));
  }
  return out.join("");
}
const CP1252 = [
  0x20ac, 0, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030,
  0x160, 0x2039, 0x152, 0, 0x17d, 0, 0, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0, 0x17e, 0x178,
];
type RtfState = {
  skip: boolean;
  inheritedSkip: boolean;
  hidden: boolean;
  uc: number;
  page: number;
  font: number;
  fontTable: boolean;
  upr: number | null;
  allowUd: boolean;
};
const DESTINATIONS = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "pict",
  "object",
  "objdata",
  "filetbl",
  "datastore",
  "xmlnstbl",
  "listtable",
  "listoverridetable",
  "rsidtbl",
  "generator",
  "header",
  "headerl",
  "headerr",
  "headerf",
  "footer",
  "footerl",
  "footerr",
  "footerf",
  "annotation",
  "nonshppict",
  "shppict",
  "private",
  "fldinst",
]);
/** Balanced, destination-aware RTF reader; styling is ignored, visible text is not. */
export function rtfToLyrics(input: Uint8Array | string): string {
  if (typeof input !== "string" && !(input instanceof Uint8Array))
    return bad("payload RTF");
  if ((typeof input === "string" ? input.length : input.byteLength) > MAX_BYTES)
    return bad("maksimal 100KiB");
  const raw =
    typeof input === "string"
      ? input
      : Array.from(input, (x) => String.fromCharCode(x)).join("");
  if (!/^\{\\rtf[01](?:\D|$)/.test(raw)) return bad("header RTF");
  const stack: RtfState[] = [];
  const fonts = new Map<number, number>();
  let defaultFont = 0;
  const out: string[] = [];
  let state: RtfState = {
    skip: false,
    inheritedSkip: false,
    hidden: false,
    uc: 1,
    page: 1252,
    font: 0,
    fontTable: false,
    upr: null,
    allowUd: false,
  };
  let fallback = 0,
    closed = false;
  let run: number[] = [];
  function emit(value: string) {
    if (fallback) {
      fallback--;
      return;
    }
    if (!state.skip && !state.hidden) out.push(value);
  }
  function flush() {
    if (!run.length) return;
    if (state.skip || state.hidden) {
      run = [];
      return;
    }
    const page = fonts.get(state.font) ?? state.page;
    let text: string;
    if (page === 65001) text = utf8(new Uint8Array(run));
    else
      text = run
        .map((x) => {
          if (x < 128) return String.fromCharCode(x);
          if (page === 28591) return String.fromCharCode(x);
          if (page !== 1252) return bad(`code page ${page}`);
          if (x >= 128 && x <= 159) {
            const point = CP1252[x - 128];
            if (!point) return bad("byte CP1252");
            return String.fromCodePoint(point);
          }
          return String.fromCharCode(x);
        })
        .join("");
    for (const character of text) emit(character);
    run = [];
  }
  for (let i = 0; i < raw.length; ) {
    const c = raw[i++];
    if (closed) {
      if (!/[\s\u0000]/.test(c)) return bad("data setelah RTF");
      continue;
    }
    if (c === "{") {
      flush();
      fallback = 0;
      if (stack.length >= 64) return bad("grup terlalu dalam");
      const parent = state;
      let skip = parent.skip,
        allowUd = false;
      if (parent.upr !== null) {
        parent.upr++;
        skip = parent.skip || parent.upr !== 2;
        allowUd = parent.upr === 2;
      }
      stack.push(parent);
      state = {
        ...parent,
        skip,
        inheritedSkip: parent.skip,
        upr: null,
        allowUd,
      };
    } else if (c === "}") {
      flush();
      fallback = 0;
      if (!stack.length) return bad("kurung RTF");
      if (state.upr !== null && state.upr !== 2)
        return bad("alternatif Unicode");
      state = stack.pop()!;
      if (!stack.length) closed = true;
    } else if (c === "\\") {
      if (i >= raw.length) return bad("kontrol terpotong");
      const next = raw[i++];
      if (next === "'") {
        const hex = raw.slice(i, i + 2);
        if (!/^[\da-f]{2}$/i.test(hex)) return bad("hex RTF");
        run.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
      flush();
      if ("{}\\".includes(next)) {
        emit(next);
        continue;
      }
      if (next === "*") {
        state.skip = true;
        continue;
      }
      if (next === "~") {
        emit(" ");
        continue;
      }
      if (next === "_") {
        emit("-");
        continue;
      }
      if (next === "-" || next === "\r" || next === "\n") continue;
      if (!/[a-z]/i.test(next)) return bad("symbole kontrol");
      let word = next;
      while (i < raw.length && /[a-z]/i.test(raw[i])) word += raw[i++];
      let numberText = "";
      if (raw[i] === "-") numberText += raw[i++];
      while (i < raw.length && /\d/.test(raw[i])) numberText += raw[i++];
      if (numberText === "-") return bad("angka kontrol");
      const number = numberText ? Number(numberText) : null;
      if (number !== null && !Number.isSafeInteger(number))
        return bad("angka kontrol");
      if (raw[i] === " ") i++;
      if (word === "bin") {
        if (number === null || number < 0 || i + number > raw.length)
          return bad("blok binary");
        i += number;
        if (fallback) fallback--;
        continue;
      }
      if (fallback) {
        fallback--;
        continue;
      }
      if (word === "ud" && state.allowUd) state.skip = state.inheritedSkip;
      else if (DESTINATIONS.has(word)) {
        state.skip = true;
        if (word === "fonttbl") state.fontTable = true;
      } else if (word === "upr") state.upr = 0;
      else if (word === "ansicpg" || word === "cpg") {
        if (number === null || number < 1) return bad("code page");
        state.page = number;
      } else if (word === "mac") state.page = 10000;
      else if (word === "pc") state.page = 437;
      else if (word === "pca") state.page = 850;
      else if (word === "deff" && number !== null) {
        defaultFont = number;
        state.font = number;
      } else if (word === "f" && number !== null) state.font = number;
      else if (word === "fcharset" && number !== null && state.fontTable) {
        if (![0, 1].includes(number)) fonts.set(state.font, -number - 1);
      } else if (word === "uc") {
        if (number === null || number < 0 || number > 16)
          return bad("Unicode fallback");
        state.uc = number;
      } else if (word === "u") {
        if (number === null || number < -32768 || number > 65535)
          return bad("Unicode escape");
        emit(String.fromCharCode((number + 65536) % 65536));
        fallback = state.uc;
      } else if (word === "v") state.hidden = number !== 0;
      else if (word === "plain") {
        state.hidden = false;
        state.font = defaultFont;
      } else {
        const visible: Record<string, string> = {
          par: "\n",
          line: "\n",
          tab: "\t",
          emdash: "—",
          endash: "–",
          lquote: "‘",
          rquote: "’",
          ldblquote: "“",
          rdblquote: "”",
          bullet: "•",
        };
        if (visible[word]) emit(visible[word]);
      }
    } else if (c !== "\r" && c !== "\n") {
      if (
        c.charCodeAt(0) > 255 ||
        (typeof input === "string" && c.charCodeAt(0) > 127)
      ) {
        flush();
        emit(c);
      } else run.push(c.charCodeAt(0));
    }
  }
  flush();
  if (!closed || stack.length) return bad("RTF terpotong");
  const text = out.join("");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(text))
    return bad("teks Unicode/binary");
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return bad("surrogate Unicode");
    } else if (unit >= 0xdc00 && unit <= 0xdfff)
      return bad("surrogate Unicode");
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        !/^[{]?[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}[}]?$/i.test(line) &&
        !singleArtifact(line),
    )
    .join("\n")
    .trim();
}
type Field = { id: number; wire: number; bytes?: Uint8Array; value?: number };
class WireReader {
  private count = 0;
  read(bytes: Uint8Array): Field[] {
    const fields: Field[] = [];
    let i = 0;
    const variable = () => {
      let value = 0,
        multiplier = 1;
      for (let n = 0; n < 10; n++) {
        if (i >= bytes.length) return bad("varint terpotong");
        const b = bytes[i++];
        if (n === 9 && b > 1) return bad("varint");
        value += (b & 127) * multiplier;
        if (!(b & 128)) return value;
        multiplier *= 128;
      }
      return bad("varint");
    };
    while (i < bytes.length) {
      if (++this.count > MAX_FIELDS) return bad("terlalu banyak kolom");
      const tag = variable();
      if (!Number.isSafeInteger(tag) || tag < 8 || tag > 0xffffffff)
        return bad("tag protobuf");
      const id = Math.floor(tag / 8),
        wire = tag % 8;
      if (wire === 0) fields.push({ id, wire, value: variable() });
      else if (wire === 1 || wire === 5) {
        const length = wire === 1 ? 8 : 4;
        if (i + length > bytes.length) return bad("fixed field terpotong");
        i += length;
        fields.push({ id, wire });
      } else if (wire === 2) {
        const length = variable();
        if (!Number.isSafeInteger(length) || length > bytes.length - i)
          return bad("panjang protobuf");
        fields.push({ id, wire, bytes: bytes.subarray(i, i + length) });
        i += length;
      } else return bad("wire type");
    }
    return fields;
  }
}
export interface ProPresenterLyrics {
  lyrics: string;
  artist: string;
  writer_credits: string;
  copyright_notice: string;
  warnings: string[];
}
/** PP7 slide RTF only: never scans notes, templates, media, or arbitrary strings. */
export function parseProPresenterFile(
  input: Uint8Array | ArrayBuffer,
): ProPresenterLyrics {
  if (!(input instanceof Uint8Array) && !(input instanceof ArrayBuffer))
    return bad("payload harus binary");
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!bytes.length || bytes.length > MAX_BYTES) return bad("ukuran 1–100KiB");
  const reader = new WireReader();
  const repeated = (fields: Field[], id: number) =>
    fields
      .filter((x) => x.id === id)
      .map((x) => {
        if (x.wire !== 2) return bad(`tipe kolom ${id}`);
        return x.bytes!;
      });
  const one = (fields: Field[], id: number) => {
    const list = repeated(fields, id);
    if (list.length > 1) return bad(`kolom tunggal ${id}`);
    return list[0];
  };
  const nested = (fields: Field[], id: number) => {
    const x = one(fields, id);
    return x ? reader.read(x) : [];
  };
  const string = (fields: Field[], id: number) => {
    const x = one(fields, id);
    return x ? utf8(x) : "";
  };
  const uuid = (fields: Field[], id: number) => string(nested(fields, id), 1);
  const root = reader.read(bytes);
  const rawCues = repeated(root, 13);
  if (!rawCues.length) return bad("tidak ada slide PP7");
  const cues = rawCues.map((raw) => {
    const cue = reader.read(raw),
      chunks: string[] = [];
    for (const actionRaw of repeated(cue, 10)) {
      const action = reader.read(actionRaw);
      const slide = nested(action, 23),
        presentation = nested(slide, 2),
        base = nested(presentation, 1);
      for (const elementRaw of repeated(base, 1)) {
        const slideElement = reader.read(elementRaw);
        // Dynamic CCLI/timer/feed elements are not canonical lyric text.
        if (repeated(slideElement, 6).length) continue;
        const graphic = nested(slideElement, 1);
        if (graphic.some((x) => x.id === 16 && x.wire === 0 && x.value === 1))
          continue;
        const text = nested(graphic, 13),
          rtf = one(text, 5);
        if (!rtf) continue;
        const cleaned = rtfToLyrics(rtf);
        // Identical whole elements in one cue are duplicated presentation layers.
        // NEVER deduplicate lines within an element or lyrics across slides.
        if (cleaned && !chunks.includes(cleaned)) chunks.push(cleaned);
      }
    }
    return { id: uuid(cue, 1), lyrics: chunks.join("\n\n") };
  });
  const byId = new Map<string, (typeof cues)[number]>();
  for (const cue of cues) {
    if (cue.id && byId.has(cue.id)) return bad("UUID slide duplikat");
    if (cue.id) byId.set(cue.id, cue);
  }
  const output: string[] = [],
    referenced = new Set<string>();
  let groupCount = 0;
  for (const raw of repeated(root, 12)) {
    const group = reader.read(raw),
      label = string(nested(group, 1), 2).trim();
    if (/[\u0000-\u001f\u007f-\u009f]/.test(label)) return bad("nama bagian");
    const texts: string[] = [];
    for (const ref of repeated(group, 2)) {
      const id = string(reader.read(ref), 1),
        cue = byId.get(id);
      if (!cue) return bad("referensi slide tidak ditemukan");
      referenced.add(id);
      if (cue.lyrics) texts.push(cue.lyrics);
    }
    if (texts.length) {
      groupCount++;
      output.push((label ? `[${label}]\n` : "") + texts.join("\n\n"));
    }
  }
  for (const cue of cues)
    if (!referenced.has(cue.id) && cue.lyrics) output.push(cue.lyrics);
  const lyrics = output.join("\n\n").trim();
  if (!lyrics) return bad("tidak ada lirik RTF pada slide");
  const ccli = nested(root, 14);
  const year = ccli.find((x) => x.id === 5 && x.wire === 0)?.value;
  return {
    lyrics,
    artist: string(ccli, 2),
    writer_credits: string(ccli, 1),
    copyright_notice: [year ? String(year) : "", string(ccli, 4)]
      .filter(Boolean)
      .join(" · "),
    warnings: [
      "Hasil native wajib diperiksa: teks statis selain lirik dapat ikut terbaca. Metadata CCLI bukan bukti izin.",
      groupCount
        ? "Bagian mengikuti urutan grup library, bukan arrangement playback terpilih."
        : "Nama bagian tidak tersedia; pemisah slide dipertahankan tanpa menebak Verse/Chorus.",
    ],
  };
}
/** Public convenience API: raw binary .pro payload, or standalone RTF for testing. */
export function parseProPresenterLyrics(
  fileInput: Uint8Array | ArrayBuffer | string,
): string {
  return typeof fileInput === "string"
    ? rtfToLyrics(fileInput)
    : parseProPresenterFile(fileInput).lyrics;
}
