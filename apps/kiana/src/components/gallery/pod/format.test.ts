import { describe, expect, it } from "vitest";

import { formatPodTime, progressPercent } from "./format";

describe("pocket player formats", () => {
  it("writes times the way the player does", () => {
    expect(formatPodTime(0)).toBe("0:00");
    expect(formatPodTime(187.9)).toBe("3:07");
    expect(formatPodTime(Number.NaN)).toBe("0:00");
  });

  it("turns the song's progress into a bar's percentage", () => {
    expect(progressPercent(50, 200)).toBe(25);
    expect(progressPercent(250, 200)).toBe(100);
    expect(progressPercent(10, 0)).toBe(0);
  });
});
