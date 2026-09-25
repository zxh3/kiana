import { describe, expect, it } from "vitest";

import {
  FAVORITES_MAX,
  isAssetId,
  parseFavoriteIds,
  parseFavoritesChange,
} from "./favorites";

const id = "00102E27-4783-4E70-93E1-8B90384A0800";

describe("isAssetId", () => {
  it("takes the library's ids and nothing stranger", () => {
    expect(isAssetId(id)).toBe(true);
    expect(isAssetId("")).toBe(false);
    expect(isAssetId("a'; DROP TABLE favorite")).toBe(false);
    expect(isAssetId("x".repeat(65))).toBe(false);
    expect(isAssetId(3)).toBe(false);
  });
});

describe("parseFavoritesChange", () => {
  it("reads additions and removals, without repeats", () => {
    expect(parseFavoritesChange({ add: [id, id] })).toEqual({
      add: [id],
      remove: [],
    });
    expect(parseFavoritesChange({ remove: [id] })).toEqual({
      add: [],
      remove: [id],
    });
  });

  it("refuses empty, broken, and oversized changes", () => {
    expect(parseFavoritesChange({})).toBeNull();
    expect(parseFavoritesChange(null)).toBeNull();
    expect(parseFavoritesChange({ add: "x" })).toBeNull();
    expect(parseFavoritesChange({ add: [id, 4] })).toBeNull();
    expect(
      parseFavoritesChange({ add: Array(FAVORITES_MAX + 1).fill(id) }),
    ).toBeNull();
  });
});

describe("parseFavoriteIds", () => {
  it("reads the Worker's answer", () => {
    expect(parseFavoriteIds({ ids: [id] })).toEqual([id]);
    expect(parseFavoriteIds({ error: "Sign in" })).toBeNull();
    expect(parseFavoriteIds("nope")).toBeNull();
  });
});
