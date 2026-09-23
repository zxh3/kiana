import { describe, expect, it } from "vitest";

import { nextFinish, parseFinish } from "./finishes";
import { formatPodTime } from "./format";
import { initialPodState } from "./machine";
import {
  angleDelta,
  menuItems,
  moveSelection,
  parentScreen,
  scrollWindow,
  takeSteps,
} from "./menu";
import { describePod, type PodView, podRows } from "./rows";
import { parseBacklight, parseClicker } from "./settings";

describe("pocket player rules", () => {
  it("measures wheel turns the short way round", () => {
    expect(angleDelta(10, 40)).toBe(30);
    expect(angleDelta(40, 10)).toBe(-30);
    expect(angleDelta(170, -170)).toBe(20);
    expect(angleDelta(-170, 170)).toBe(-20);
  });

  it("turns travel into whole clicks and keeps the remainder", () => {
    expect(takeSteps(40, 15)).toEqual({ steps: 2, rest: 10 });
    expect(takeSteps(-40, 15)).toEqual({ steps: -2, rest: -10 });
    expect(takeSteps(14, 15)).toEqual({ steps: 0, rest: 14 });
  });

  it("stops lists at their ends", () => {
    expect(moveSelection(0, -1, 5)).toBe(0);
    expect(moveSelection(3, 4, 5)).toBe(4);
    expect(moveSelection(1, 2, 5)).toBe(3);
  });

  it("scrolls a long list only as far as the selection needs", () => {
    expect(scrollWindow(0, 3, 12, 7)).toBe(0);
    expect(scrollWindow(0, 7, 12, 7)).toBe(1);
    expect(scrollWindow(5, 2, 12, 7)).toBe(2);
    expect(scrollWindow(0, 4, 5, 7)).toBe(0);
  });

  it("goes back to the menu from every screen, and nowhere from the menu", () => {
    expect(parentScreen.now).toBe("menu");
    expect(parentScreen.covers).toBe("menu");
    expect(parentScreen.menu).toBeNull();
  });

  it("keeps Now Playing last in the menu, as on the original", () => {
    expect(menuItems.at(-1)).toBe("now");
  });

  it("writes times the way the player does", () => {
    expect(formatPodTime(0)).toBe("0:00");
    expect(formatPodTime(187.9)).toBe("3:07");
    expect(formatPodTime(Number.NaN)).toBe("0:00");
  });

  it("reads saved settings and falls back to the defaults", () => {
    expect(parseFinish("rose")).toBe("rose");
    expect(parseFinish("gold")).toBe("silver");
    expect(nextFinish("rose")).toBe("silver");
    expect(parseBacklight("always")).toBe("always");
    expect(parseBacklight(null)).toBe("timed");
    expect(parseClicker(null)).toBe(true);
    expect(parseClicker("false")).toBe(false);
  });

  it("describes the screen for a screen reader", () => {
    const view: PodView = {
      playlist: [
        { videoId: "a", title: "One", artist: "First" },
        { videoId: "b", title: "Two", artist: "Second" },
      ],
      index: 1,
      shuffle: false,
      repeat: "all",
      backlight: "timed",
      clicker: true,
      finish: "silver",
      videoOpen: false,
      volume: 42,
      current: 65,
      duration: 200,
    };
    const rows = podRows(view);
    const state = initialPodState(1);
    expect(describePod(state, rows, view)).toBe("Now Playing: Two, Second");
    expect(describePod({ ...state, overlay: "volume" }, rows, view)).toBe(
      "Volume 42%",
    );
    expect(describePod({ ...state, overlay: "scrub" }, rows, view)).toBe(
      "Position 1:05 of 3:20",
    );
    expect(
      describePod(
        {
          ...state,
          screen: "settings",
          selected: { ...state.selected, settings: 3 },
        },
        rows,
        view,
      ),
    ).toBe("Clicker, On");
    expect(rows.songs[1].current).toBe(true);
  });
});
