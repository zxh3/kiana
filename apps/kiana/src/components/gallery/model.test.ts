import { describe, expect, it } from "vitest";

import { formatPhotoDate, SLIDE_DURATION, transitionFor } from "./model";

describe("gallery model", () => {
  it("uses a ten-second duration for timed slides", () => {
    expect(SLIDE_DURATION).toBe(10_000);
  });

  it("formats known dates and leaves missing dates blank", () => {
    expect(formatPhotoDate("2026-08-16")).toBe("16 AUGUST 2026");
    expect(formatPhotoDate(null)).toBe("");
  });

  it("uses a transition tailored to each frame", () => {
    expect(transitionFor("fill")).toBe("fade");
    expect(transitionFor("backdrop")).toBe("float");
    expect(transitionFor("mat")).toBe("settle");
  });
});
