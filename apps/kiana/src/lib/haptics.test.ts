import { describe, expect, it } from "vitest";

import { isIosDevice, tapAllowed } from "./haptics";

describe("isIosDevice", () => {
  it("knows iPhones, and iPads that call themselves a Mac", () => {
    const iphone = {
      maxTouchPoints: 5,
      platform: "iPhone",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    };
    const ipad = {
      maxTouchPoints: 5,
      platform: "MacIntel",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    };
    expect(isIosDevice(iphone)).toBe(true);
    expect(isIosDevice(ipad)).toBe(true);
  });

  it("leaves out Macs and Android phones", () => {
    expect(
      isIosDevice({
        maxTouchPoints: 0,
        platform: "MacIntel",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      }),
    ).toBe(false);
    expect(
      isIosDevice({
        maxTouchPoints: 5,
        platform: "Linux armv8l",
        userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9)",
      }),
    ).toBe(false);
  });
});

describe("tapAllowed", () => {
  it("allows the first tap and spaces the rest", () => {
    expect(tapAllowed(null, 0)).toBe(true);
    expect(tapAllowed(100, 110)).toBe(false);
    expect(tapAllowed(100, 130)).toBe(true);
  });
});
