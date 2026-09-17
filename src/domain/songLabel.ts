export function songLabel(
  title: string | null | undefined,
  key: string | null | undefined,
): string {
  const name = title?.trim() || "Lagu";
  const tone = key?.trim();
  return tone ? `${name} - ${tone}` : name;
}

export function requiredSongTitle(title: string): string {
  const name = title.trim();
  if (!name) throw new Error("Judul lagu wajib diisi.");
  return name;
}
