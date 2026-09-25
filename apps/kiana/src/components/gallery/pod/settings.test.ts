import { describe, expect, it } from "vitest";

import { nextFinish, parseFinish } from "./device/finishes";
import { parseBacklight, parseClicker } from "./settings";

describe("pocket player settings", () => {
  it("reads saved settings and falls back to the defaults", () => {
    expect(parseFinish("rose")).toBe("rose");
    expect(parseFinish("gold")).toBe("silver");
    expect(nextFinish("rose")).toBe("silver");
    expect(parseBacklight("always")).toBe("always");
    expect(parseBacklight(null)).toBe("timed");
    expect(parseClicker(null)).toBe(true);
    expect(parseClicker("false")).toBe(false);
  });
});
