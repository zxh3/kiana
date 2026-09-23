import { describe, expect, it } from "vitest";

import type { GalleryAsset } from "../../data/photos";
import { chronologicalIndexes } from "./collections";
import {
  buildRows,
  centeredOffset,
  groupByMonth,
  libraryIndexes,
  rowContaining,
  yearAnchors,
} from "./library-layout";

function asset(id: string, date: string | null, type: GalleryAsset["type"]) {
  return {
    id,
    type,
    date,
    time: null,
    small: id,
    large: id,
    width: 1,
    height: 1,
  } satisfies GalleryAsset;
}

const assets = [
  asset("oct-a", "2024-10-02", "photo"),
  asset("old", "2023-01-05", "video"),
  asset("none", null, "photo"),
  asset("oct-b", "2024-10-20", "live_photo"),
  asset("sep", "2024-09-01", "photo"),
];
const chronological = chronologicalIndexes(assets);

describe("library layout", () => {
  it("lists oldest first with undated assets at the end", () => {
    expect(libraryIndexes(assets, chronological, "all", new Set())).toEqual([
      1, 4, 0, 3, 2,
    ]);
  });

  it("filters by media type and by favorites", () => {
    expect(libraryIndexes(assets, chronological, "video", new Set())).toEqual([
      1,
    ]);
    expect(
      libraryIndexes(assets, chronological, "favorites", new Set(["sep"])),
    ).toEqual([4]);
  });

  it("groups by month and splits months into rows of tiles", () => {
    const indexes = libraryIndexes(assets, chronological, "all", new Set());
    const groups = groupByMonth(assets, indexes);
    expect(groups.map((group) => group.key)).toEqual([
      "2023-01",
      "2024-09",
      "2024-10",
      "undated",
    ]);

    const rows = buildRows(groups, 1);
    expect(rows.map((row) => row.kind)).toEqual([
      "intro",
      "month",
      "tiles",
      "month",
      "tiles",
      "month",
      "tiles",
      "tiles",
      "month",
      "tiles",
    ]);
    expect(rowContaining(rows, 0)).toBe(6);
    expect(yearAnchors(rows)).toEqual([
      { year: 2023, row: 1 },
      { year: 2024, row: 3 },
    ]);
  });

  it("centres a row in the viewport and clamps at both ends", () => {
    const heights = [300, 100, 200, 200, 200, 200, 100];
    expect(centeredOffset(heights, 3, 400)).toBe(500);
    expect(centeredOffset(heights, 1, 400)).toBe(150);
    expect(centeredOffset(heights, 0, 400)).toBe(0);
    expect(centeredOffset(heights, 6, 400)).toBe(900);
    expect(centeredOffset([100], 0, 400)).toBe(0);
  });

  it("shows an empty row when nothing matches", () => {
    expect(buildRows([], 4).map((row) => row.kind)).toEqual(["intro", "empty"]);
  });
});
