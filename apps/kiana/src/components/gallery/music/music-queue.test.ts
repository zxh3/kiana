import { describe, expect, it } from "vitest";

import {
  afterFailure,
  nextTrackIndex,
  parseRepeat,
  parseShuffle,
  previousMove,
  previousTrackIndex,
  rememberTrack,
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

  it("remembers shuffled songs to step back through, the last 50", () => {
    expect(rememberTrack([1, 2], 3, true)).toEqual([1, 2, 3]);
    const long = Array.from({ length: 50 }, (_, index) => index);
    expect(rememberTrack(long, 99, true)).toHaveLength(50);
    expect(rememberTrack(long, 99, true).at(-1)).toBe(99);
    const inOrder = [4];
    expect(rememberTrack(inOrder, 3, false)).toBe(inOrder);
  });

  it("restarts a song past three seconds, or goes back", () => {
    const base = { history: [2, 4], index: 1, length: 5, shuffle: false };
    expect(previousMove({ ...base, elapsed: 3.5 })).toEqual({ restart: true });
    expect(previousMove({ ...base, elapsed: 1 })).toEqual({
      index: 0,
      history: [2, 4],
    });
    expect(previousMove({ ...base, elapsed: 1, shuffle: true })).toEqual({
      index: 4,
      history: [2],
    });
    expect(
      previousMove({ ...base, elapsed: 1, shuffle: true, history: [] }),
    ).toEqual({ index: 0, history: [] });
  });

  it("tries the next song in order after a failure, until all have failed", () => {
    expect(afterFailure(4, 5, 1)).toBe(0);
    expect(afterFailure(1, 5, 4)).toBe(2);
    expect(afterFailure(1, 5, 5)).toBeNull();
  });
});
