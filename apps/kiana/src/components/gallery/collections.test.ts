import { describe, expect, it } from "vitest";

import type { GalleryAsset } from "../../data/photos";
import {
  chronologicalIndexes,
  onThisDay,
  parseCollectionId,
  resolveCollection,
  yearCounts,
} from "./collections";

function asset(id: string, date: string | null, time: string | null = null) {
  return {
    id,
    type: "photo",
    date,
    time,
    small: `${id}-small`,
    large: `${id}-large`,
    width: 4,
    height: 3,
  } satisfies GalleryAsset;
}

const assets = [
  asset("c", "2024-09-23", "18:00"),
  asset("undated", null),
  asset("a", "2020-09-23", "09:00"),
  asset("b", "2024-09-23", "07:30"),
  asset("d", "2021-02-28"),
];

describe("collections", () => {
  it("sorts assets oldest first with undated ones last", () => {
    expect(chronologicalIndexes(assets)).toEqual([2, 4, 3, 0, 1]);
  });

  it("parses only known collection ids", () => {
    expect(parseCollectionId("on-this-day")).toBe("on-this-day");
    expect(parseCollectionId("year-2024")).toBe("year-2024");
    expect(parseCollectionId("month-2024-10")).toBe("month-2024-10");
    expect(parseCollectionId("month-2024-13")).toBeNull();
    expect(parseCollectionId("everything")).toBeNull();
    expect(parseCollectionId(null)).toBeNull();
  });

  it("counts assets per year, newest year first", () => {
    expect(yearCounts(assets)).toEqual([
      { year: 2024, count: 2 },
      { year: 2021, count: 1 },
      { year: 2020, count: 1 },
    ]);
  });

  it("widens a sparse day to the surrounding week", () => {
    const chronological = chronologicalIndexes(assets);
    const exact = onThisDay(assets, chronological, "2026-09-23");
    expect(exact.widened).toBe(true);
    expect(exact.members).toEqual([2, 3, 0]);

    const acrossMonths = onThisDay(assets, chronological, "2026-03-02");
    expect(acrossMonths.members).toEqual([4]);
  });

  it("keeps an exact day when it has enough photos", () => {
    const busy = Array.from({ length: 6 }, (_, index) =>
      asset(`day-${index}`, `20${20 + index}-05-01`),
    );
    const result = onThisDay(busy, chronologicalIndexes(busy), "2026-05-01");
    expect(result.widened).toBe(false);
    expect(result.members).toHaveLength(6);
  });

  it("resolves years, months, and favorites in chronological order", () => {
    const context = {
      assets,
      chronological: chronologicalIndexes(assets),
      favorites: new Set(["c", "a"]),
      today: "2026-09-23",
    };
    expect(resolveCollection("year-2024", context).members).toEqual([3, 0]);
    expect(resolveCollection("month-2021-02", context)).toMatchObject({
      label: "February 2021",
      members: [4],
    });
    expect(resolveCollection("favorites", context).members).toEqual([2, 0]);
    expect(resolveCollection("on-this-day", context).detail).toBe(
      "The week around 23 September",
    );
  });
});
