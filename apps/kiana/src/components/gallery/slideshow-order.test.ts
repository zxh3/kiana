import { describe, expect, it } from "vitest";

import { shuffledIndexes, upcomingIndexes } from "./slideshow-order";

describe("slideshow order", () => {
  it("shuffles every index exactly once", () => {
    const order = shuffledIndexes(5, () => 0.25);

    expect(order).toHaveLength(5);
    expect([...order].sort((left, right) => left - right)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(order).not.toEqual([0, 1, 2, 3, 4]);
  });

  it("can prevent the next round from immediately repeating an asset", () => {
    expect(shuffledIndexes(3, () => 0.99, 0)[0]).not.toBe(0);
  });

  it("looks into the next shuffled round when preloading", () => {
    expect(upcomingIndexes([2, 0, 1], [2, 1, 0], 1, 2)).toEqual([1, 2]);
  });
});
