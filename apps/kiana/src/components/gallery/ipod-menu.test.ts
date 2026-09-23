import { describe, expect, it } from "vitest";

import { nextFinish, parseFinish } from "./ipod-finishes";
import {
  angleDelta,
  moveSelection,
  parentScreen,
  scrollWindow,
  takeSteps,
} from "./ipod-menu";

describe("pocket player", () => {
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

  it("goes back to the menu from every screen but the menu", () => {
    expect(parentScreen.now).toBe("menu");
    expect(parentScreen.songs).toBe("menu");
    expect(parentScreen.menu).toBeNull();
  });

  it("keeps a saved finish and cycles through them", () => {
    expect(parseFinish("rose")).toBe("rose");
    expect(parseFinish("gold")).toBe("silver");
    expect(nextFinish("rose")).toBe("silver");
  });
});
