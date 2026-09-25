import { describe, expect, it } from "vitest";

import {
  applyHiddenChange,
  HIDDEN_CHANGE_MAX,
  indexHidden,
  parseHiddenChange,
} from "./hidden-photos";

const a = "00102E27-4783-4E70-93E1-8B90384A0800";
const b = "00168ABA-C9A6-407D-9BEB-E7082C701E32";

describe("parseHiddenChange", () => {
  it("reads photos to hide and to show, without repeats", () => {
    expect(parseHiddenChange({ hide: [a, a] })).toEqual({
      hide: [a],
      show: [],
    });
    expect(parseHiddenChange({ show: [b] })).toEqual({ hide: [], show: [b] });
  });

  it("refuses empty, junk, contradictory, and oversized changes", () => {
    expect(parseHiddenChange({})).toBeNull();
    expect(parseHiddenChange(null)).toBeNull();
    expect(parseHiddenChange({ hide: "a" })).toBeNull();
    expect(parseHiddenChange({ hide: ["a'; DROP TABLE x"] })).toBeNull();
    expect(parseHiddenChange({ hide: [a], show: [a] })).toBeNull();
    const many = Array.from({ length: HIDDEN_CHANGE_MAX + 1 }, (_, i) =>
      String(i),
    );
    expect(parseHiddenChange({ hide: many })).toBeNull();
  });
});

describe("applyHiddenChange", () => {
  it("hides and shows, keeping who hid a photo first", () => {
    const before = indexHidden([{ id: a, by: "Amy", at: 1 }]);
    const after = applyHiddenChange(
      before,
      { hide: [a, b], show: [] },
      "Zed",
      2,
    );
    expect(after.get(a)).toEqual({ id: a, by: "Amy", at: 1 });
    expect(after.get(b)).toEqual({ id: b, by: "Zed", at: 2 });
    expect(before.has(b)).toBe(false);
    expect(
      applyHiddenChange(after, { hide: [], show: [a] }, "Zed", 3).has(a),
    ).toBe(false);
  });
});
