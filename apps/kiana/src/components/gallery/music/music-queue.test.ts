import { describe, expect, it } from "vitest";

import {
  nextTrackIndex,
  parseRepeat,
  parseShuffle,
  previousTrackIndex,
} from "./music-queue";

describe("music queue", () => {
  it("steps through the list and wraps in both directions", () => {
    expect(nextTrackIndex(0, 5, false)).toBe(1);
    expect(nextTrackIndex(4, 5, false)).toBe(0);
    expect(previousTrackIndex(0, 5)).toBe(4);
    expect(previousTrackIndex(3, 5)).toBe(2);
    expect(nextTrackIndex(0, 1, false)).toBe(0);
  });

  it("shuffles to any track except the current one", () => {
    const picks = new Set<number>();
    for (let step = 0; step < 50; step += 1) {
      picks.add(nextTrackIndex(2, 5, true, () => step / 50));
    }
    expect([...picks].sort()).toEqual([0, 1, 3, 4]);
    expect(nextTrackIndex(2, 5, true, () => 0.999_999)).toBe(4);
  });

  it("reads saved shuffle and repeat, defaulting to the list in order", () => {
    expect(parseShuffle("true")).toBe(true);
    expect(parseShuffle("false")).toBe(false);
    expect(parseShuffle(null)).toBe(false);
    expect(parseRepeat("one")).toBe("one");
    expect(parseRepeat("loop")).toBe("all");
  });
});
