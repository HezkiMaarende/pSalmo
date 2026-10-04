export interface MedleyGroup {
  id: string;
  setlist_id: string;
  position: number;
  label: string | null;
}

export interface MedleyItem {
  id: string;
  position: number;
  medley_group_id: string | null;
}

export type SetlistUnit<T extends MedleyItem> =
  | { kind: "song"; key: string; items: T[] }
  | { kind: "medley"; key: string; group: MedleyGroup; items: T[] };

export function medleyLabel(group: MedleyGroup): string {
  return group.label?.trim() || "Medley";
}

export function buildSetlistUnits<T extends MedleyItem>(
  items: T[],
  groups: MedleyGroup[],
): SetlistUnit<T>[] {
  const ordered = [...items].sort((a, b) => a.position - b.position);
  const byId = new Map(groups.map((group) => [group.id, group]));
  const result: SetlistUnit<T>[] = [];
  for (const item of ordered) {
    const group = item.medley_group_id
      ? byId.get(item.medley_group_id)
      : undefined;
    const last = result[result.length - 1];
    if (group && last?.kind === "medley" && last.group.id === group.id) {
      last.items.push(item);
    } else if (group) {
      result.push({ kind: "medley", key: group.id, group, items: [item] });
    } else {
      result.push({ kind: "song", key: item.id, items: [item] });
    }
  }
  return result;
}

export function medleyContext<T extends MedleyItem>(
  item: T,
  items: T[],
  groups: MedleyGroup[],
): string | null {
  const unit = buildSetlistUnits(items, groups).find(
    (candidate) =>
      candidate.kind === "medley" &&
      candidate.items.some((song) => song.id === item.id),
  );
  if (!unit || unit.kind !== "medley") return null;
  return `${medleyLabel(unit.group)} · lagu ${unit.items.findIndex((song) => song.id === item.id) + 1}/${unit.items.length}`;
}

export function rangeSelection<T extends MedleyItem>(
  items: T[],
  startId: string,
  endId: string,
  editingGroupId?: string,
): T[] {
  const ordered = [...items].sort((a, b) => a.position - b.position);
  const start = ordered.findIndex((item) => item.id === startId);
  const end = ordered.findIndex((item) => item.id === endId);
  if (start < 0 || end < 0 || start >= end)
    throw new Error("Pilih minimal dua lagu berurutan dari awal ke akhir.");
  const selected = ordered.slice(start, end + 1);
  if (
    selected.some(
      (item) => item.medley_group_id && item.medley_group_id !== editingGroupId,
    )
  )
    throw new Error("Rentang tidak boleh mengambil lagu dari medley lain.");
  if (
    editingGroupId &&
    !selected.some((item) => item.medley_group_id === editingGroupId)
  )
    throw new Error("Rentang edit harus mencakup medley saat ini.");
  return selected;
}
