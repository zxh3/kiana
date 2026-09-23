import { describe, expect, it } from "vitest";

import { buildQueue, previousMember, shuffledIndexes } from "./slideshow-order";

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

  it("queues every other member once when shuffling", () => {
    const queue = buildQueue([10, 20, 30, 40], "shuffle", 20, () => 0.4);
    expect([...queue].sort((left, right) => left - right)).toEqual([
      10, 30, 40,
    ]);
  });

  it("continues chronologically from the current member and wraps", () => {
    expect(buildQueue([10, 20, 30, 40], "chronological", 30)).toEqual([
      40, 10, 20,
    ]);
    expect(buildQueue([10, 20, 30], "chronological", undefined)).toEqual([
      10, 20, 30,
    ]);
  });

  it("finds the chronologically previous member", () => {
    expect(previousMember([10, 20, 30], 20)).toBe(10);
    expect(previousMember([10, 20, 30], 10)).toBe(30);
    expect(previousMember([10], 10)).toBeUndefined();
  });
});
