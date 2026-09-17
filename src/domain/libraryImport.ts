import { parseProPresenterFile } from "./proPresenter";
export const IMPORT_LIMITS = {
  files: 50,
  fileBytes: 100 * 1024,
  totalBytes: 2 * 1024 * 1024,
  lyricChars: 102400,
};
export interface LibraryIdentity {
  id: string;
  title: string;
  artist: string | null;
}
export interface ImportCandidate {
  parse_warnings?: string[];
  id: string;
  selected: boolean;
  source_filename: string;
  title: string;
  artist: string;
  lyrics: string;
  writer_credits: string;
  copyright_notice: string;
  key: string;
  bpm: string;
  time_signature: string;
}
export interface LibraryImportEntry {
  source_filename: string;
  title: string;
  artist: string;
  lyrics: string;
  writer_credits: string;
  copyright_notice: string;
  key: string;
  bpm: number | null;
  time_signature: string;
}
export interface LibraryImportResult {
  created: { id: string; title: string; source_filename: string }[];
  skipped: { id: string; title: string; source_filename: string }[];
}
export function identityKey(title: string, artist: string | null): string {
  const normalize = (value: string) =>
    value.replace(/\s+/g, " ").trim().toLowerCase();
  return JSON.stringify([normalize(title), normalize(artist || "")]);
}
export function assertFileBounds(sizes: number[]) {
  if (!sizes.length || sizes.length > IMPORT_LIMITS.files)
    throw Error("Pilih 1–50 file .txt/.pro/.propresenter.");
  if (
    sizes.some(
      (size) =>
        !Number.isInteger(size) || size < 1 || size > IMPORT_LIMITS.fileBytes,
    )
  )
    throw Error("Setiap file harus berisi teks dan maksimal 100KiB.");
  if (sizes.reduce((sum, size) => sum + size, 0) > IMPORT_LIMITS.totalBytes)
    throw Error("Total file maksimal 2MiB.");
}
export function decodeSongText(bytes: Uint8Array): string {
  const invalid = () => {
    throw Error(
      "Encoding teks tidak valid. Ekspor sebagai UTF-8 atau UTF-16 dengan BOM.",
    );
  };
  const codepoints: number[] = [];
  if (
    bytes.length >= 2 &&
    ((bytes[0] === 255 && bytes[1] === 254) ||
      (bytes[0] === 254 && bytes[1] === 255))
  ) {
    if ((bytes.length - 2) % 2) invalid();
    const little = bytes[0] === 255;
    const unit = (i: number) =>
      little ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1];
    for (let i = 2; i < bytes.length; i += 2) {
      const a = unit(i);
      if (a >= 0xd800 && a <= 0xdbff) {
        if (i + 3 >= bytes.length) invalid();
        const b = unit(i + 2);
        if (b < 0xdc00 || b > 0xdfff) invalid();
        codepoints.push(0x10000 + ((a - 0xd800) << 10) + b - 0xdc00);
        i += 2;
      } else {
        if (a >= 0xdc00 && a <= 0xdfff) invalid();
        codepoints.push(a);
      }
    }
  } else {
    for (
      let i = bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191 ? 3 : 0;
      i < bytes.length;

    ) {
      const a = bytes[i++];
      let count = 0,
        value = a,
        minimum = 0;
      if (a < 128) {
        codepoints.push(a);
        continue;
      }
      if (a >= 194 && a <= 223) {
        count = 1;
        value = a & 31;
        minimum = 128;
      } else if (a >= 224 && a <= 239) {
        count = 2;
        value = a & 15;
        minimum = 2048;
      } else if (a >= 240 && a <= 244) {
        count = 3;
        value = a & 7;
        minimum = 65536;
      } else invalid();
      if (i + count > bytes.length) invalid();
      for (let n = 0; n < count; n++) {
        const b = bytes[i++];
        if ((b & 192) !== 128) invalid();
        value = (value << 6) | (b & 63);
      }
      if (
        value < minimum ||
        value > 0x10ffff ||
        (value >= 0xd800 && value <= 0xdfff)
      )
        invalid();
      codepoints.push(value);
    }
  }
  if (
    codepoints.some(
      (value) =>
        (value < 32 && ![9, 10, 13].includes(value)) ||
        (value >= 127 && value <= 159),
    )
  )
    throw Error(
      "File mengandung kontrol/binary, bukan teks lagu yang didukung.",
    );
  const text = codepoints
    .map((value) => String.fromCodePoint(value))
    .join("")
    .replace(/\r\n?/g, "\n");
  if (!text.trim()) throw Error("File teks kosong.");
  return text;
}
export function candidateFromFile(
  name: string,
  bytes: Uint8Array,
  id: string,
): ImportCandidate {
  if (
    !/\.(txt|pro|propresenter)$/i.test(name) ||
    /[\\/\u0000-\u001f]/.test(name) ||
    name.length > 255
  )
    throw Error(
      "Gunakan .txt/.pro/.propresenter dengan nama file valid (maks. 255 karakter).",
    );
  assertFileBounds([bytes.length]);
  const native = !/\.txt$/i.test(name) ? parseProPresenterFile(bytes) : null;
  return {
    id,
    selected: true,
    source_filename: name,
    title: name.replace(/\.(txt|pro|propresenter)$/i, "").trim(),
    lyrics: native?.lyrics ?? decodeSongText(bytes),
    artist: native?.artist ?? "",
    writer_credits: native?.writer_credits ?? "",
    copyright_notice: native?.copyright_notice ?? "",
    ...(native ? { parse_warnings: native.warnings } : {}),
    key: "",
    bpm: "",
    time_signature: "4/4",
  };
}
export function duplicateCandidates(
  candidates: ImportCandidate[],
  songs: LibraryIdentity[],
): Set<string> {
  const keys = new Set(
    songs.map((song) => identityKey(song.title, song.artist)),
  );
  const duplicates = new Set<string>();
  for (const candidate of candidates) {
    const key = identityKey(candidate.title, candidate.artist);
    if (keys.has(key)) duplicates.add(candidate.id);
    else if (candidate.selected) keys.add(key);
  }
  return duplicates;
}
export function importEntries(
  candidates: ImportCandidate[],
  permission: string,
): LibraryImportEntry[] {
  if (!permission.trim() || permission.trim().length > 2000)
    throw Error(
      "Isi dasar izin penyimpanan/berbagi lirik (maks. 2.000 karakter).",
    );
  const selected = candidates.filter((candidate) => candidate.selected);
  if (!selected.length || selected.length > 50) throw Error("Pilih 1–50 lagu.");
  return selected.map((candidate) => {
    if (
      !candidate.title.trim() ||
      candidate.title.trim().length > 200 ||
      candidate.artist.length > 200
    )
      throw Error("Judul wajib diisi; judul/artis maksimal 200 karakter.");
    if (
      !candidate.lyrics.trim() ||
      candidate.lyrics.length > IMPORT_LIMITS.lyricChars
    )
      throw Error("Lirik wajib diisi, maksimal 102.400 karakter.");
    if (
      candidate.writer_credits.length > 2000 ||
      candidate.copyright_notice.length > 2000 ||
      candidate.key.length > 20
    )
      throw Error(
        "Kredit/copyright maksimal 2.000 karakter; key maksimal 20 karakter.",
      );
    const bpm = candidate.bpm.trim() ? Number(candidate.bpm) : null;
    if (bpm !== null && (!Number.isInteger(bpm) || bpm < 20 || bpm > 400))
      throw Error("BPM harus bilangan bulat 20–400.");
    if (!/^(?:[1-9]|1[0-2])\/(?:2|4|8)$/.test(candidate.time_signature))
      throw Error("Pilih salah satu dari 36 birama.");
    return {
      source_filename: candidate.source_filename,
      title: candidate.title.trim(),
      artist: candidate.artist.trim(),
      lyrics: candidate.lyrics,
      writer_credits: candidate.writer_credits.trim(),
      copyright_notice: candidate.copyright_notice.trim(),
      key: candidate.key.trim(),
      bpm,
      time_signature: candidate.time_signature,
    };
  });
}
