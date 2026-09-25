import type { GalleryAsset } from "../../data/photos";

/** The space between tiles, and the widest the grid grows. */
export const TILE_GAP = 3;
export const MAX_CONTENT_WIDTH = 1680;

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
  /** Asset indexes, oldest first. */
  items: number[];
};

export type LibraryRow =
  | { kind: "intro"; key: string }
  | { kind: "empty"; key: string }
  | { kind: "month"; key: string; group: MonthGroup }
  | { kind: "tiles"; key: string; group: MonthGroup; items: number[] };

/** Filtered asset indexes, oldest first, with undated assets last. */
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
  return [...dated, ...undated];
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

/**
 * The scroll offset that centres row `row` in a viewport of `viewport`
 * pixels, clamped to the scrollable range.
 */
export function centeredOffset(
  heights: ReadonlyArray<number>,
  row: number,
  viewport: number,
) {
  let start = 0;
  let total = 0;
  heights.forEach((height, index) => {
    if (index < row) start += height;
    total += height;
  });
  const offset = start - (viewport - (heights[row] ?? 0)) / 2;
  return Math.max(0, Math.min(offset, total - viewport));
}

export function rowContaining(rows: ReadonlyArray<LibraryRow>, index: number) {
  return rows.findIndex(
    (row) => row.kind === "tiles" && row.items.includes(index),
  );
}

/** The first row of each year, in the order the years appear. */
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

/**
 * The grid's measurements for a library `width` wide: compact on phones,
 * its padding and the year rail's room, and as many columns as fit tiles
 * near the target size, at least three, filling the width exactly.
 */
export function gridGeometry(width: number) {
  const compact = width < 640;
  const sidePadding = compact ? 12 : 40;
  const railSpace = compact ? 48 : 88;
  const contentWidth = Math.max(
    0,
    Math.min(width, MAX_CONTENT_WIDTH) - sidePadding - railSpace,
  );
  const targetTile = compact ? 112 : 172;
  const columns = Math.max(
    3,
    Math.round((contentWidth + TILE_GAP) / (targetTile + TILE_GAP)),
  );
  const tileSize = (contentWidth - TILE_GAP * (columns - 1)) / columns;
  return { compact, sidePadding, railSpace, columns, tileSize };
}

/** How tall each kind of row is drawn. */
export function rowHeightFor(
  row: LibraryRow,
  compact: boolean,
  tileSize: number,
) {
  if (row.kind === "intro") return compact ? 200 : 300;
  if (row.kind === "empty") return 220;
  if (row.kind === "month") return compact ? 76 : 108;
  return tileSize + TILE_GAP;
}

/** How many of each kind, and of the viewer's favorites, for the filters. */
export function libraryCounts(
  assets: ReadonlyArray<GalleryAsset>,
  favorites: ReadonlySet<string>,
) {
  const counts: Record<LibraryFilter, number> = {
    all: assets.length,
    photo: 0,
    live_photo: 0,
    video: 0,
    favorites: 0,
  };
  for (const asset of assets) {
    counts[asset.type] += 1;
    if (favorites.has(asset.id)) counts.favorites += 1;
  }
  return counts;
}

/** The first and last years the months cover, if any has a year. */
export function yearSpan(groups: ReadonlyArray<MonthGroup>) {
  const years = groups.flatMap((group) => (group.year ? [group.year] : []));
  return years.length
    ? { from: Math.min(...years), to: Math.max(...years) }
    : null;
}
