import { describe, expect, it } from "vitest";

import {
  blurSpread,
  coast,
  drawnSpeed,
  flick,
  kick,
  parseBestRpm,
  rpm,
  SPIN_FLICK,
  SPIN_KICK,
  SPIN_MAX,
} from "./spinner";

describe("finger spinner", () => {
  it("speeds up with each click, brakes the other way, and tops out", () => {
    expect(kick(0, 3)).toBe(3 * SPIN_KICK);
    expect(kick(3 * SPIN_KICK, -1)).toBe(2 * SPIN_KICK);
    expect(kick(0, -2)).toBe(-2 * SPIN_KICK);
    expect(kick(SPIN_MAX - 10, 5)).toBe(SPIN_MAX);
    expect(kick(-SPIN_MAX, -5)).toBe(-SPIN_MAX);
  });

  it("flicks the way it already turns, clockwise from rest", () => {
    expect(flick(0)).toBe(SPIN_FLICK);
    expect(flick(-100)).toBe(-100 - SPIN_FLICK);
    expect(flick(SPIN_MAX)).toBe(SPIN_MAX);
  });

  it("coasts slower and slower, then stops without turning back", () => {
    const later = coast(3_000, 1);
    expect(later).toBeLessThan(3_000);
    expect(later).toBeGreaterThan(2_000);
    expect(coast(-3_000, 1)).toBe(-later);
    expect(coast(20, 1)).toBe(0);
    let speed = SPIN_MAX;
    let seconds = 0;
    while (speed !== 0 && seconds < 120) {
      speed = coast(speed, 1 / 60);
      seconds += 1 / 60;
    }
    // From top speed it runs down in well under a minute, but not at once.
    expect(seconds).toBeGreaterThan(20);
    expect(seconds).toBeLessThan(60);
  });

  it("reads out revolutions per minute", () => {
    expect(rpm(360)).toBe(60);
    expect(rpm(-SPIN_MAX)).toBe(2_400);
  });

  it("draws fast spins no faster than a ceiling, blurring them instead", () => {
    expect(drawnSpeed(0)).toBe(0);
    expect(drawnSpeed(100)).toBeCloseTo(100, 0);
    expect(drawnSpeed(SPIN_MAX)).toBeLessThanOrEqual(1_500);
    expect(drawnSpeed(-SPIN_MAX)).toBe(-drawnSpeed(SPIN_MAX));
    expect(drawnSpeed(4_000)).toBeGreaterThan(drawnSpeed(2_000));
    expect(blurSpread(0)).toBe(0);
    expect(blurSpread(-SPIN_MAX)).toBe(110);
  });

  it("keeps a best speed only when it is a sensible number", () => {
    expect(parseBestRpm("1234")).toBe(1_234);
    expect(parseBestRpm(null)).toBe(0);
    expect(parseBestRpm("junk")).toBe(0);
    expect(parseBestRpm("-5")).toBe(0);
  });
});
