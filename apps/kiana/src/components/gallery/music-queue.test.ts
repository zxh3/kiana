import { describe, expect, it } from "vitest";

import {
  afterSongEnds,
  nextInOrder,
  parsePlayMode,
  previousInOrder,
  shuffleBag,
} from "./music-queue";

describe("music queue", () => {
  it("steps through the list and wraps in both directions", () => {
    expect(nextInOrder(0, 5)).toBe(1);
    expect(nextInOrder(4, 5)).toBe(0);
    expect(previousInOrder(0, 5)).toBe(4);
    expect(previousInOrder(3, 5)).toBe(2);
    expect(nextInOrder(0, 1)).toBe(0);
  });

  it("plays the list in order and loops back to the start (列表循环)", () => {
    expect(afterSongEnds(2, 5, "all")).toEqual({ kind: "play", index: 3 });
    expect(afterSongEnds(4, 5, "all")).toEqual({ kind: "play", index: 0 });
  });

  it("repeats the current song (单曲循环)", () => {
    expect(afterSongEnds(4, 5, "one")).toEqual({ kind: "repeat" });
    expect(afterSongEnds(0, 5, "one")).toEqual({ kind: "repeat" });
  });

  it("shuffles every other song exactly once per round (随机播放)", () => {
    expect(afterSongEnds(1, 5, "shuffle")).toEqual({ kind: "shuffle" });
    for (let trial = 0; trial < 20; trial += 1) {
      const bag = shuffleBag(5, 2);
      expect([...bag].sort()).toEqual([0, 1, 3, 4]);
    }
  });

  it("parses play modes, keeping a saved repeat-all choice", () => {
    expect(parsePlayMode("all")).toBe("all");
    expect(parsePlayMode("one")).toBe("one");
    expect(parsePlayMode("shuffle")).toBe("shuffle");
    expect(parsePlayMode("loop")).toBe("all");
    expect(parsePlayMode(null)).toBe("all");
  });
});
