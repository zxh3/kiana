import { describe, expect, it } from "vitest";

import { menuItems, moveSelection, screens, scrollWindow } from "./menu";

describe("pocket player menus", () => {
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
    expect(screens.now.parent).toBe("menu");
    expect(screens.covers.parent).toBe("menu");
    expect(screens.menu.parent).toBeNull();
  });

  it("keeps Now Playing last in the menu, as on the original", () => {
    expect(menuItems.at(-1)).toBe("now");
  });
});
