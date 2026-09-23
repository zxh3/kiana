import { describe, expect, it } from "vitest";

import {
  formatAgo,
  formatClockTime,
  formatDayMonth,
  formatDurationLabel,
  formatMediaDuration,
  formatPhotoDate,
  formatWeekday,
  SLIDE_DURATION,
  transitionFor,
} from "./model";

describe("gallery model", () => {
  it("uses a ten-second default for timed slides", () => {
    expect(SLIDE_DURATION).toBe(10_000);
  });

  it("formats known dates and leaves missing dates blank", () => {
    expect(formatPhotoDate("2026-08-16")).toBe("16 August 2026");
    expect(formatPhotoDate(null)).toBe("");
    expect(formatDayMonth("2026-09-23")).toBe("23 September");
    expect(formatDayMonth("02-29")).toBe("29 February");
    expect(formatWeekday("2025-11-23")).toBe("Sunday");
  });

  it("formats clock times and media durations", () => {
    expect(formatClockTime("13:09")).toBe("1:09 PM");
    expect(formatClockTime("00:05")).toBe("12:05 AM");
    expect(formatMediaDuration(14_833)).toBe("0:15");
    expect(formatMediaDuration(1_397_833)).toBe("23:18");
    expect(formatMediaDuration(3_725_000)).toBe("1:02:05");
    expect(formatDurationLabel(5_000)).toBe("5s");
    expect(formatDurationLabel(60_000)).toBe("1m");
  });

  it("describes how long ago a photo was taken", () => {
    const today = "2026-09-23";
    expect(formatAgo("2026-09-23", today)).toBe("Today");
    expect(formatAgo("2026-09-22", today)).toBe("Yesterday");
    expect(formatAgo("2026-09-11", today)).toBe("12 days ago");
    expect(formatAgo("2026-06-30", today)).toBe("2 months ago");
    expect(formatAgo("2025-09-24", today)).toBe("11 months ago");
    expect(formatAgo("2025-09-23", today)).toBe("1 year ago");
    expect(formatAgo("2019-04-01", today)).toBe("7 years ago");
  });

  it("uses a transition tailored to each frame", () => {
    expect(transitionFor("fill")).toBe("fade");
    expect(transitionFor("backdrop")).toBe("float");
    expect(transitionFor("mat")).toBe("settle");
  });
});
