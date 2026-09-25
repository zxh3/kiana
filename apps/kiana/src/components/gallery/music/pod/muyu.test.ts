import { describe, expect, it } from "vitest";

import { KNOCKS_PER_FRAME } from "../../../../lib/muyu";
import {
  initialMuyuState,
  type MuyuEvent,
  type MuyuState,
  muyuReducer,
  nextFrame,
  parseMerit,
  shownMerit,
  shownMine,
} from "./muyu";

const run = (events: MuyuEvent[], state: MuyuState = initialMuyuState) =>
  events.reduce(muyuReducer, state);

const merit = (total: number, ack?: number, mine?: number): MuyuEvent => ({
  type: "received",
  message: {
    type: "merit",
    total,
    here: 2,
    ...(ack === undefined ? {} : { ack }),
    ...(mine === undefined ? {} : { mine }),
  },
});

describe("muyuReducer", () => {
  it("shows nothing until the room says how much merit there is", () => {
    expect(shownMerit(initialMuyuState)).toBeNull();
    const open = run([merit(40)]);
    expect(open.status).toBe("open");
    expect(shownMerit(open)).toBe(40);
  });

  it("adds this browser's pats at once, and never counts them twice", () => {
    const patted = run([merit(40), { type: "pat" }, { type: "pat" }]);
    expect(shownMerit(patted)).toBe(42);
    expect(nextFrame(patted)).toEqual({ seq: 0, count: 2 });

    const sent = run(
      [{ type: "sent", seq: 0, count: 2 }, { type: "pat" }],
      patted,
    );
    expect(shownMerit(sent)).toBe(43);
    // Someone else's pat arrives before the answer: both show.
    const other = run([merit(41)], sent);
    expect(shownMerit(other)).toBe(44);
    // The answer has ours in the total now.
    const answered = run([merit(43, 0)], other);
    expect(answered.sending).toEqual([]);
    expect(shownMerit(answered)).toBe(44);
  });

  it("sends no more than a frame's worth at once", () => {
    const many = run(
      Array.from(
        { length: KNOCKS_PER_FRAME + 3 },
        () => ({ type: "pat" }) as const,
      ),
      run([merit(0)]),
    );
    expect(nextFrame(many)?.count).toBe(KNOCKS_PER_FRAME);
    const rest = run([{ type: "sent", seq: 0, count: KNOCKS_PER_FRAME }], many);
    expect(nextFrame(rest)).toEqual({ seq: 1, count: 3 });
  });

  it("lets go of frames in flight when the connection drops", () => {
    const state = run([
      merit(10),
      { type: "pat" },
      { type: "sent", seq: 0, count: 1 },
      { type: "pat" },
      { type: "offline" },
    ]);
    expect(state.sending).toEqual([]);
    expect(state.queued).toBe(1);
    expect(state.pats).toBe(2);
  });

  it("shows a signed-in viewer's own merit from the room, with pats on top", () => {
    expect(shownMine(run([merit(40)]))).toBeNull();
    const signedIn = run([merit(40, undefined, 7), { type: "pat" }]);
    expect(shownMine(signedIn)).toBe(8);
    const sent = run([{ type: "sent", seq: 0, count: 1 }], signedIn);
    expect(shownMine(sent)).toBe(8);
    // Another of their devices patted too, then this one's frame is in.
    const answered = run([merit(43, undefined, 9), merit(44, 0, 10)], sent);
    expect(shownMine(answered)).toBe(10);
    // Signed out, the room no longer says.
    expect(shownMine(run([merit(44)], answered))).toBeNull();
  });
});

describe("parseMerit", () => {
  it("keeps a count and drops junk", () => {
    expect(parseMerit("12")).toBe(12);
    expect(parseMerit(null)).toBe(0);
    expect(parseMerit("-3")).toBe(0);
    expect(parseMerit("1.5")).toBe(0);
    expect(parseMerit("lots")).toBe(0);
  });
});
