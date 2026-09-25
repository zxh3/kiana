import { describe, expect, it } from "vitest";

import { angleDelta, takeSteps, wheelZoneAt } from "./wheel";

describe("click wheel", () => {
  it("measures wheel turns the short way round", () => {
    expect(angleDelta(10, 40)).toBe(30);
    expect(angleDelta(40, 10)).toBe(-30);
    expect(angleDelta(170, -170)).toBe(20);
    expect(angleDelta(-170, 170)).toBe(-20);
  });

  it("finds the wheel button under an angle, a quarter of the ring each", () => {
    expect(wheelZoneAt(-90)).toBe("menu");
    expect(wheelZoneAt(0)).toBe("next");
    expect(wheelZoneAt(90)).toBe("play");
    expect(wheelZoneAt(180)).toBe("previous");
    expect(wheelZoneAt(-180)).toBe("previous");
    expect(wheelZoneAt(-50)).toBe("menu");
    expect(wheelZoneAt(-40)).toBe("next");
    expect(wheelZoneAt(140)).toBe("previous");
  });

  it("turns travel into whole clicks and keeps the remainder", () => {
    expect(takeSteps(40, 15)).toEqual({ steps: 2, rest: 10 });
    expect(takeSteps(-40, 15)).toEqual({ steps: -2, rest: -10 });
    expect(takeSteps(14, 15)).toEqual({ steps: 0, rest: 14 });
  });
});
