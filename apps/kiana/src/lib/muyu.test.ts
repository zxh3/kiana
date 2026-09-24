import { describe, expect, it } from "vitest";

import {
  KNOCKS_PER_FRAME,
  KNOCKS_PER_SECOND,
  parseMuyuClientMessage,
  parseMuyuServerMessage,
  takeKnocks,
} from "./muyu";

describe("takeKnocks", () => {
  it("counts knocks up to the limit each second", () => {
    const first = takeKnocks(undefined, 5, 1_000);
    expect(first).toEqual({ accepted: 5, budget: { start: 1_000, used: 5 } });
    const rest = takeKnocks(first.budget, KNOCKS_PER_SECOND, 1_500);
    expect(rest.accepted).toBe(KNOCKS_PER_SECOND - 5);
    expect(takeKnocks(rest.budget, 3, 1_900).accepted).toBe(0);
  });

  it("starts afresh the next second", () => {
    const full = { start: 1_000, used: KNOCKS_PER_SECOND };
    expect(takeKnocks(full, 3, 2_000)).toEqual({
      accepted: 3,
      budget: { start: 2_000, used: 3 },
    });
  });
});

describe("parseMuyuClientMessage", () => {
  it("reads a frame of knocks", () => {
    expect(
      parseMuyuClientMessage('{"type":"knock","count":3,"seq":7}'),
    ).toEqual({ type: "knock", count: 3, seq: 7 });
  });

  it("ignores empty, oversized, fractional, and unknown frames", () => {
    const frame = (count: unknown, seq: unknown = 1) =>
      JSON.stringify({ type: "knock", count, seq });
    expect(parseMuyuClientMessage(frame(0))).toBeNull();
    expect(parseMuyuClientMessage(frame(KNOCKS_PER_FRAME + 1))).toBeNull();
    expect(parseMuyuClientMessage(frame(1.5))).toBeNull();
    expect(parseMuyuClientMessage(frame(-2))).toBeNull();
    expect(parseMuyuClientMessage(frame(1, "a"))).toBeNull();
    expect(parseMuyuClientMessage('{"type":"reset"}')).toBeNull();
    expect(parseMuyuClientMessage("ping")).toBeNull();
  });
});

describe("parseMuyuServerMessage", () => {
  it("reads the total, with or without an answer", () => {
    expect(
      parseMuyuServerMessage('{"type":"merit","total":12,"here":2,"ack":3}'),
    ).toEqual({ type: "merit", total: 12, here: 2, ack: 3 });
    expect(
      parseMuyuServerMessage('{"type":"merit","total":12,"here":2}'),
    ).toEqual({ type: "merit", total: 12, here: 2 });
  });

  it("ignores what it does not know", () => {
    expect(parseMuyuServerMessage("pong")).toBeNull();
    expect(
      parseMuyuServerMessage('{"type":"merit","total":-1,"here":0}'),
    ).toBeNull();
  });
});
