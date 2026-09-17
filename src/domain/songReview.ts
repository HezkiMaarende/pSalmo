export interface ReviewSong {
  id: string;
  title: string;
  artist: string | null;
}
export interface SongCandidate {
  id: string;
  title: string;
  selected: boolean;
  songId: string | null;
}
export interface ReviewedSongEntry {
  title: string;
  song_id: string | null;
}
export function normalizedTitle(title: string): string {
  return title.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}
export function matchingSongs(
  title: string,
  songs: ReviewSong[],
): ReviewSong[] {
  const key = normalizedTitle(title);
  if (!key) return [];
  return songs.filter((song) => normalizedTitle(song.title) === key);
}
// Deliberately not an AI extractor: every nonempty line is shown for review.
// Strip only list markers/paired WhatsApp formatting, never infer key/BPM/roles.
export function previewSongText(
  raw: string,
  songs: ReviewSong[],
): SongCandidate[] {
  if (raw.length > 10000) throw new Error("Pesan maksimal 10.000 karakter.");
  const titles = raw
    .split(/\r?\n/)
    .map((line) => {
      let title = line
        .trim()
        .replace(/^(?:\d+[.)]\s+|[-•]\s+)/, "")
        .trim();
      if (/^\*[^*]+\*$/.test(title)) title = title.slice(1, -1).trim();
      return title;
    })
    .filter(Boolean);
  if (!titles.length || titles.length > 50)
    throw new Error(
      "Gunakan 1–50 baris lagu. Hapus header/chat yang tidak diperlukan.",
    );
  if (titles.some((title) => title.length > 200))
    throw new Error(
      "Judul maksimal 200 karakter. Pisahkan pesan menjadi baris lagu.",
    );
  return titles.map((title, index) => {
    const matches = matchingSongs(title, songs);
    return {
      id: String(index),
      title,
      selected: true,
      songId: matches.length === 1 ? matches[0].id : null,
    };
  });
}
export function reviewedEntries(
  candidates: SongCandidate[],
  songs: ReviewSong[],
): ReviewedSongEntry[] {
  const selected = candidates.filter((candidate) => candidate.selected);
  if (!selected.length || selected.length > 50)
    throw new Error("Pilih 1–50 lagu untuk ditambahkan.");
  return selected.map((candidate) => {
    const song = candidate.songId
      ? songs.find((item) => item.id === candidate.songId)
      : null;
    if (candidate.songId && !song)
      throw new Error("Lagu Song Bank tidak tersedia. Buat ulang pratinjau.");
    const title = (song?.title || candidate.title).trim();
    if (!title || title.length > 200)
      throw new Error("Isi judul lagu (maksimal 200 karakter).");
    return { title, song_id: song?.id || null };
  });
}
