import { describe, expect, it } from "vitest";

import {
  nextPlayMode,
  nextTrackIndex,
  parsePlayMode,
  previousTrackIndex,
} from "./music-queue";

describe("music queue", () => {
  it("steps through the list and wraps in both directions", () => {
    expect(nextTrackIndex(0, 5, "all")).toBe(1);
    expect(nextTrackIndex(4, 5, "all")).toBe(0);
    expect(nextTrackIndex(2, 5, "one")).toBe(3);
    expect(previousTrackIndex(0, 5)).toBe(4);
    expect(previousTrackIndex(3, 5)).toBe(2);
    expect(nextTrackIndex(0, 1, "all")).toBe(0);
  });

  it("shuffles to any track except the current one", () => {
    const picks = new Set<number>();
    for (let step = 0; step < 50; step += 1) {
      picks.add(nextTrackIndex(2, 5, "shuffle", () => step / 50));
    }
    expect([...picks].sort()).toEqual([0, 1, 3, 4]);
    expect(nextTrackIndex(2, 5, "shuffle", () => 0.999_999)).toBe(4);
  });

  it("cycles and parses play modes", () => {
    expect(nextPlayMode("all")).toBe("one");
    expect(nextPlayMode("one")).toBe("shuffle");
    expect(nextPlayMode("shuffle")).toBe("all");
    expect(parsePlayMode("one")).toBe("one");
    expect(parsePlayMode("loop")).toBe("all");
  });
});
