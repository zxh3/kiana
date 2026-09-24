import { describe, expect, it } from "vitest";

import { retryDelay } from "./live-socket";

describe("retryDelay", () => {
  it("doubles up to half a minute", () => {
    expect([0, 1, 2, 10].map(retryDelay)).toEqual([
      1_000, 2_000, 4_000, 30_000,
    ]);
  });
});
