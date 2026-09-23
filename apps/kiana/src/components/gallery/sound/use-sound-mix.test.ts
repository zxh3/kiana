import { describe, expect, it } from "vitest";

import { parseFlagOn, parseLevel } from "./use-sound-mix";

describe("sound mix", () => {
  it("keeps a saved level and falls back on junk", () => {
    expect(parseLevel("40")).toBe(40);
    expect(parseLevel("0")).toBe(0);
    expect(parseLevel(null)).toBe(100);
    expect(parseLevel("")).toBe(100);
    expect(parseLevel("140")).toBe(100);
    expect(parseLevel("loud", 70)).toBe(70);
  });

  it("keeps interface sounds on unless they were turned off", () => {
    expect(parseFlagOn(null)).toBe(true);
    expect(parseFlagOn("true")).toBe(true);
    expect(parseFlagOn("false")).toBe(false);
  });
});
