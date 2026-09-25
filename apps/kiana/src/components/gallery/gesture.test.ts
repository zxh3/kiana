import { describe, expect, it } from "vitest";

import { classifyTouch } from "./gesture";

const at = (x: number, y: number, time = 0) => ({ x, y, time });

describe("classifyTouch", () => {
  it("reads a sideways swipe as the next or previous photo", () => {
    expect(classifyTouch(at(200, 100), at(100, 110, 200))).toBe("next");
    expect(classifyTouch(at(100, 100), at(200, 90, 200))).toBe("previous");
  });

  it("ignores short or slanted swipes", () => {
    expect(classifyTouch(at(100, 100), at(140, 100, 200))).toBeNull();
    expect(classifyTouch(at(100, 100), at(160, 160, 200))).toBeNull();
  });

  it("reads a quick, still touch as a tap, and a slow one as nothing", () => {
    expect(classifyTouch(at(100, 100), at(104, 97, 150))).toBe("tap");
    expect(classifyTouch(at(100, 100), at(104, 97, 500))).toBeNull();
    expect(classifyTouch(at(100, 100), at(112, 100, 150))).toBeNull();
  });
});
