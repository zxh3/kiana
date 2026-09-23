import { describe, expect, it } from "vitest";

import { nearestCorner, parseCorner, parsePlayerSize } from "./music-layout";

describe("music player layout", () => {
  it("snaps to the corner of the quadrant it was dropped in", () => {
    expect(nearestCorner(100, 100, 1000, 800)).toBe("top-left");
    expect(nearestCorner(900, 100, 1000, 800)).toBe("top-right");
    expect(nearestCorner(100, 700, 1000, 800)).toBe("bottom-left");
    expect(nearestCorner(900, 700, 1000, 800)).toBe("bottom-right");
    expect(nearestCorner(500, 400, 1000, 800)).toBe("bottom-right");
  });

  it("keeps a saved corner and size and ignores junk", () => {
    expect(parseCorner("top-left")).toBe("top-left");
    expect(parsePlayerSize("mini")).toBe("mini");
    expect(parsePlayerSize("full")).toBe("full");
    // Without a window (tests run in Node) the wide-screen defaults apply.
    expect(parseCorner("middle")).toBe("bottom-right");
    expect(parsePlayerSize(null)).toBe("full");
  });
});
