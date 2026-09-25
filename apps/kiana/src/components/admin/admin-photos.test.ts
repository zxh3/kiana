import { describe, expect, it } from "vitest";

import type { GalleryAsset } from "../../data/photos";
import { indexHidden } from "../../lib/hidden-photos";
import { chronologicalIndexes } from "../gallery/collections";
import {
  adminIndexes,
  changeFor,
  describeHidden,
  photoCounts,
  selectRange,
  toggleSelection,
} from "./admin-photos";

const asset = (id: string, date: string | null): GalleryAsset => ({
  id,
  type: "photo",
  date,
  time: null,
  small: `${id}.webp`,
  large: `${id}.webp`,
  width: 1,
  height: 1,
});

const assets = [
  asset("b", "2024-02-01"),
  asset("undated", null),
  asset("c", "2025-03-01"),
  asset("a", "2023-01-01"),
];
const chronological = chronologicalIndexes(assets);
const hidden = indexHidden([{ id: "c", by: "Amy", at: 0 }]);
const ids = (indexes: number[]) => indexes.map((index) => assets[index].id);

describe("adminIndexes", () => {
  it("lists the newest first and the undated last", () => {
    expect(ids(adminIndexes(assets, chronological, "all", hidden))).toEqual([
      "c",
      "b",
      "a",
      "undated",
    ]);
  });

  it("filters by whether the gallery shows each", () => {
    expect(ids(adminIndexes(assets, chronological, "hidden", hidden))).toEqual([
      "c",
    ]);
    expect(ids(adminIndexes(assets, chronological, "shown", hidden))).toEqual([
      "b",
      "a",
      "undated",
    ]);
  });
});

describe("photoCounts", () => {
  it("counts only hidden photos that are in the release", () => {
    const withOld = indexHidden([
      { id: "c", by: "Amy", at: 0 },
      { id: "gone", by: null, at: 0 },
    ]);
    expect(photoCounts(assets, withOld)).toEqual({
      all: 4,
      shown: 3,
      hidden: 1,
    });
  });
});

describe("selection", () => {
  const order = [2, 0, 3, 1];

  it("selects a range either way round, in the grid's order", () => {
    expect(selectRange(order, 0, 1)).toEqual([0, 3, 1]);
    expect(selectRange(order, 1, 0)).toEqual([0, 3, 1]);
    expect(selectRange(order, 9, 1)).toEqual([1]);
  });

  it("adds a group, or takes it out when all of it was in", () => {
    const some = toggleSelection(new Set([0]), [0, 3]);
    expect([...some].sort()).toEqual([0, 3]);
    expect([...toggleSelection(some, [0, 3])]).toEqual([]);
  });
});

describe("changeFor", () => {
  it("changes only the photos not already that way", () => {
    expect(changeFor(assets, [0, 2], hidden, "hide")).toEqual({
      hide: ["b"],
      show: [],
    });
    expect(changeFor(assets, [0, 2], hidden, "show")).toEqual({
      hide: [],
      show: ["c"],
    });
    expect(changeFor(assets, [2], hidden, "hide")).toBeNull();
  });
});

describe("describeHidden", () => {
  it("says who hid a photo and when", () => {
    const at = Date.UTC(2026, 8, 24, 12);
    expect(describeHidden({ id: "c", by: "Amy", at })).toBe(
      "Hidden by Amy on 24 September 2026",
    );
    expect(describeHidden({ id: "c", by: null, at })).toBe(
      "Hidden on 24 September 2026",
    );
  });
});
