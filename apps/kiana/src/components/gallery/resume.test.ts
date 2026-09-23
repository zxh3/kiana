import { describe, expect, it } from "vitest";

import { parseResume } from "./resume";

describe("resume positions", () => {
  it("reads saved positions and ignores junk", () => {
    expect(parseResume('{"all":"A","year-2021":"B"}')).toEqual({
      all: "A",
      "year-2021": "B",
    });
    expect(parseResume('{"all":3,"favorites":"C"}')).toEqual({
      favorites: "C",
    });
    expect(parseResume("[1,2]")).toEqual({});
    expect(parseResume("not json")).toEqual({});
    expect(parseResume(null)).toEqual({});
  });
});
