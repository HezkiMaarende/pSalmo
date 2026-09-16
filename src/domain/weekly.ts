export function homeMessage(
  admin: boolean,
  published: boolean,
  assignedCount: number,
): string | null {
  if (admin) return null;
  if (!published) return "Jadwal minggu ini belum diumumkan";
  return assignedCount === 0 ? "Tidak ada tugas minggu ini" : null;
}
