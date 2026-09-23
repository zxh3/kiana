import type { GalleryAsset } from "../../data/photos";

export const libraryFilters = [
  "all",
  "photo",
  "live_photo",
  "video",
  "favorites",
] as const;
export type LibraryFilter = (typeof libraryFilters)[number];

export const libraryFilterLabels: Record<LibraryFilter, string> = {
  all: "All",
  photo: "Photos",
  live_photo: "Live",
  video: "Videos",
  favorites: "Favorites",
};

export type MonthGroup = {
  /** "2024-10", or "undated". */
  key: string;
  year: number | null;
  month: number | null;
  /** Asset indexes, newest first. */
  items: number[];
};

export type LibraryRow =
  | { kind: "intro"; key: string }
  | { kind: "empty"; key: string }
  | { kind: "month"; key: string; group: MonthGroup }
  | { kind: "tiles"; key: string; group: MonthGroup; items: number[] };

/** Filtered asset indexes, newest first, with undated assets last. */
export function libraryIndexes(
  assets: ReadonlyArray<GalleryAsset>,
  chronological: ReadonlyArray<number>,
  filter: LibraryFilter,
  favorites: ReadonlySet<string>,
) {
  const matches = (asset: GalleryAsset) =>
    filter === "all" ||
    (filter === "favorites" ? favorites.has(asset.id) : asset.type === filter);
  const dated: number[] = [];
  const undated: number[] = [];
  for (const index of chronological) {
    const asset = assets[index];
    if (!matches(asset)) continue;
    (asset.date ? dated : undated).push(index);
  }
  return [...dated.reverse(), ...undated];
}

export function groupByMonth(
  assets: ReadonlyArray<GalleryAsset>,
  indexes: ReadonlyArray<number>,
): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const index of indexes) {
    const date = assets[index].date;
    const key = date ? date.slice(0, 7) : "undated";
    let group = groups.at(-1);
    if (group?.key !== key) {
      group = {
        key,
        year: date ? Number(date.slice(0, 4)) : null,
        month: date ? Number(date.slice(5, 7)) : null,
        items: [],
      };
      groups.push(group);
    }
    group.items.push(index);
  }
  return groups;
}

export function buildRows(
  groups: ReadonlyArray<MonthGroup>,
  columns: number,
): LibraryRow[] {
  const rows: LibraryRow[] = [{ kind: "intro", key: "intro" }];
  if (groups.length === 0) rows.push({ kind: "empty", key: "empty" });
  const width = Math.max(1, columns);
  for (const group of groups) {
    rows.push({ kind: "month", key: `month-${group.key}`, group });
    for (let start = 0; start < group.items.length; start += width) {
      rows.push({
        kind: "tiles",
        key: `tiles-${group.key}-${start}`,
        group,
        items: group.items.slice(start, start + width),
      });
    }
  }
  return rows;
}

export function rowContaining(rows: ReadonlyArray<LibraryRow>, index: number) {
  return rows.findIndex(
    (row) => row.kind === "tiles" && row.items.includes(index),
  );
}

/** The first row of each year, newest year first. */
export function yearAnchors(rows: ReadonlyArray<LibraryRow>) {
  const anchors: Array<{ year: number; row: number }> = [];
  rows.forEach((row, position) => {
    if (row.kind !== "month" || row.group.year === null) return;
    if (anchors.at(-1)?.year !== row.group.year) {
      anchors.push({ year: row.group.year, row: position });
    }
  });
  return anchors;
}
