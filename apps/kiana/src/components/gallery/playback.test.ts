import { describe, expect, it } from "vitest";

import {
  advance,
  canRetreat,
  createPlayback,
  currentIndex,
  jump,
  type PlaybackSource,
  retarget,
  retreat,
  upcoming,
} from "./playback";

const chronological: PlaybackSource = {
  members: [0, 1, 2, 3],
  order: "chronological",
};
const shuffled: PlaybackSource = {
  members: [0, 1, 2, 3],
  order: "shuffle",
  random: () => 0.5,
};

describe("playback", () => {
  it("starts at a requested asset without a previous layer", () => {
    const playback = createPlayback(chronological, 2);
    expect(currentIndex(playback)).toBe(2);
    expect(playback.previous).toBeNull();
    expect(upcoming(playback, 2)).toEqual([3, 0]);
  });

  it("steps back through what was shown, then forward again", () => {
    let playback = createPlayback(shuffled, 0);
    playback = advance(playback, shuffled);
    playback = advance(playback, shuffled);
    const [first, second, third] = playback.history;

    playback = retreat(playback, shuffled);
    expect(currentIndex(playback)).toBe(second);
    expect(playback.previous).toBe(third);
    playback = retreat(playback, shuffled);
    expect(currentIndex(playback)).toBe(first);
    expect(canRetreat(playback, shuffled)).toBe(false);
    expect(retreat(playback, shuffled)).toBe(playback);

    playback = advance(playback, shuffled);
    expect(currentIndex(playback)).toBe(second);
  });

  it("plays every member once before a new shuffled round", () => {
    let playback = createPlayback(shuffled, 1);
    const seen = [currentIndex(playback)];
    for (let step = 0; step < 3; step += 1) {
      playback = advance(playback, shuffled);
      seen.push(currentIndex(playback));
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    playback = advance(playback, shuffled);
    expect(currentIndex(playback)).not.toBe(seen.at(-1));
  });

  it("walks backwards past the start when playing by date", () => {
    let playback = createPlayback(chronological, 0);
    expect(canRetreat(playback, chronological)).toBe(true);
    playback = retreat(playback, chronological);
    expect(currentIndex(playback)).toBe(3);
    playback = advance(playback, chronological);
    expect(currentIndex(playback)).toBe(0);
  });

  it("jumps to an asset and continues from it", () => {
    let playback = createPlayback(chronological, 0);
    playback = jump(playback, chronological, 2);
    expect(currentIndex(playback)).toBe(2);
    expect(playback.previous).toBe(0);
    playback = advance(playback, chronological);
    expect(currentIndex(playback)).toBe(3);
    playback = retreat(retreat(playback, chronological), chronological);
    expect(currentIndex(playback)).toBe(0);
  });

  it("keeps the visible asset when the new collection contains it", () => {
    const playback = createPlayback(chronological, 1);
    const kept = retarget(playback, {
      members: [1, 3],
      order: "chronological",
    });
    expect(currentIndex(kept)).toBe(1);
    expect(kept.slide).toBe(playback.slide);
    expect(upcoming(kept, 3)).toEqual([3]);

    const moved = retarget(playback, {
      members: [2, 3],
      order: "chronological",
    });
    expect(currentIndex(moved)).toBe(2);
    expect(moved.previous).toBe(1);
    expect(moved.slide).toBe(playback.slide + 1);
  });

  it("stays put when a collection has a single asset", () => {
    const single: PlaybackSource = { members: [5], order: "shuffle" };
    const playback = createPlayback(single);
    expect(currentIndex(playback)).toBe(5);
    expect(advance(playback, single)).toBe(playback);
  });
});
