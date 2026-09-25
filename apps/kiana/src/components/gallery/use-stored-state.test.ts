import { describe, expect, it } from "vitest";

import { parseFlag, parseFlagOn, parseLevel } from "./use-stored-state";

describe("stored preference parsers", () => {
  it("keeps a saved level and falls back on junk", () => {
    expect(parseLevel("40")).toBe(40);
    expect(parseLevel("0")).toBe(0);
    expect(parseLevel(null)).toBe(100);
    expect(parseLevel("")).toBe(100);
    expect(parseLevel("140")).toBe(100);
    expect(parseLevel("loud", 70)).toBe(70);
  });

  it("keeps a switch on unless it was turned off", () => {
    expect(parseFlagOn(null)).toBe(true);
    expect(parseFlagOn("true")).toBe(true);
    expect(parseFlagOn("false")).toBe(false);
  });

  it("keeps a switch off unless it was turned on", () => {
    expect(parseFlag(null)).toBe(false);
    expect(parseFlag("yes")).toBe(false);
    expect(parseFlag("true")).toBe(true);
  });
});
