import { describe, expect, it } from "vitest";

import { cues } from "./cues";
import { createGate } from "./gate";
import { recipes } from "./recipes";

describe("sound gate", () => {
  it("holds back a cue repeated too quickly", () => {
    const gate = createGate({ maxVoices: 8, minGap: 30 });
    expect(gate.admit("next", 1)).toBe(true);
    expect(gate.admit("next", 1.02)).toBe(false);
    expect(gate.admit("next", 1.04)).toBe(true);
    expect(gate.admit("select", 1.041)).toBe(true);
  });

  it("honours a cue's own gap", () => {
    const gate = createGate({ maxVoices: 8, minGap: 30 });
    expect(gate.admit("next", 2, 45)).toBe(true);
    expect(gate.admit("next", 2.04, 45)).toBe(false);
    expect(gate.admit("next", 2.05, 45)).toBe(true);
  });

  it("caps overlapping sounds until earlier ones finish", () => {
    const gate = createGate({ maxVoices: 2, minGap: 0 });
    expect(gate.admit("a", 0)).toBe(true);
    gate.track(0.5);
    expect(gate.admit("b", 0.1)).toBe(true);
    gate.track(0.5);
    expect(gate.admit("c", 0.2)).toBe(false);
    expect(gate.admit("c", 0.6)).toBe(true);
  });

  it("gives every cue a recipe", () => {
    for (const cue of Object.values(cues)) {
      expect(recipes[cue.recipe]).toBeTypeOf("function");
    }
  });
});
