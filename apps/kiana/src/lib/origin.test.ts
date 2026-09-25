import { describe, expect, it } from "vitest";

import { fromElsewhere } from "./origin";

describe("fromElsewhere", () => {
  it("lets the site's own pages, and requests without an origin, through", () => {
    expect(fromElsewhere("https://kiana.me", "kiana.me")).toBe(false);
    expect(fromElsewhere(null, "kiana.me")).toBe(false);
  });

  it("refuses other sites, and origins that are not addresses", () => {
    expect(fromElsewhere("https://evil.example", "kiana.me")).toBe(true);
    expect(fromElsewhere("null", "kiana.me")).toBe(true);
  });
});
