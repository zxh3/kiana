import { describe, expect, it } from "vitest";

import {
  type FavoritesEvent,
  type FavoritesState,
  favoritesReducer,
  initialFavoritesState,
  shownFavorites,
} from "./favorites";

const run = (events: FavoritesEvent[], state = initialFavoritesState) =>
  events.reduce(favoritesReducer, state);
const shown = (state: FavoritesState) => [...shownFavorites(state)].sort();

describe("favoritesReducer", () => {
  it("loads the account's favorites", () => {
    const loading = run([{ type: "loading" }]);
    expect(loading.status).toBe("loading");
    const ready = run(
      [{ type: "loaded", ids: ["a", "b"], version: 0 }],
      loading,
    );
    expect(ready.status).toBe("ready");
    expect(shown(ready)).toEqual(["a", "b"]);
  });

  it("shows a change at once, and keeps it once saved", () => {
    const ready = run([{ type: "loaded", ids: ["a"], version: 0 }]);
    const changed = run(
      [
        { type: "toggle", id: "b" },
        { type: "toggle", id: "a" },
      ],
      ready,
    );
    expect(changed.pending).toEqual([
      { add: ["b"], remove: [] },
      { add: [], remove: ["a"] },
    ]);
    expect(shown(changed)).toEqual(["b"]);
    expect(changed.pending).toHaveLength(2);
    // The first is saved; the second still shows on top.
    const first = run([{ type: "saved", ids: ["a", "b"] }], changed);
    expect(shown(first)).toEqual(["b"]);
    const both = run([{ type: "saved", ids: ["b"] }], first);
    expect(both.pending).toEqual([]);
    expect(shown(both)).toEqual(["b"]);
  });

  it("puts the heart back when the Worker refuses, and counts it", () => {
    const ready = run([{ type: "loaded", ids: [], version: 0 }]);
    const failed = run(
      [
        { type: "change", change: { add: ["a"], remove: [] } },
        { type: "saveFailed" },
      ],
      ready,
    );
    expect(shown(failed)).toEqual([]);
    expect(failed.failures).toBe(1);
  });

  it("ignores a read that began before a change was saved", () => {
    const ready = run([{ type: "loaded", ids: [], version: 0 }]);
    const saved = run(
      [
        { type: "change", change: { add: ["a"], remove: [] } },
        { type: "saved", ids: ["a"] },
      ],
      ready,
    );
    expect(
      shown(run([{ type: "loaded", ids: [], version: 0 }], saved)),
    ).toEqual(["a"]);
    expect(
      shown(run([{ type: "loaded", ids: ["a", "c"], version: 1 }], saved)),
    ).toEqual(["a", "c"]);
  });

  it("keeps showing what it has when a later read fails", () => {
    const ready = run([{ type: "loaded", ids: ["a"], version: 0 }]);
    const failed = run([{ type: "loadFailed" }], ready);
    expect(failed.status).toBe("ready");
    expect(run([{ type: "loadFailed" }]).status).toBe("error");
  });

  it("forgets everything on signing out", () => {
    const ready = run([
      { type: "loaded", ids: ["a"], version: 0 },
      { type: "change", change: { add: ["b"], remove: [] } },
    ]);
    const out = run([{ type: "signedOut" }], ready);
    expect(out.status).toBe("idle");
    expect(shown(out)).toEqual([]);
    expect(out.pending).toEqual([]);
  });
});
