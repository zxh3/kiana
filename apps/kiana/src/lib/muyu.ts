/**
 * The electronic wooden fish's wire protocol and rules, shared by the
 * browser and the Durable Object that keeps everyone's count
 * (`src/server/wooden-fish.ts`). Kept free of both so the rules can be
 * tested on their own.
 */

import { readJsonObject } from "./json";

/** Where the browser opens its WebSocket to the wooden fish. */
export const MUYU_PATH = "/api/muyu";

/**
 * Each person's knocks count up to this many a second, well past the
 * fastest thumb, so a script cannot run the count up.
 */
export const KNOCKS_PER_SECOND = 20;
/** The browser sends its knocks together, at most this often. */
export const SEND_EVERY = 250;
/** The longest frame either side reads; anything longer is ignored. */
const FRAME_MAX = 200;
/** The most knocks one frame may carry. */
export const KNOCKS_PER_FRAME = KNOCKS_PER_SECOND;

/** From the browser: this many knocks, numbered so the reply can say so. */
export type MuyuClientMessage = { type: "knock"; count: number; seq: number };

/**
 * From the room: everyone's merit so far and how many are knocking. `ack`
 * answers the sender's frame of that number, once its knocks are in the
 * total. `mine` is the merit of the account this browser signed in with,
 * from every device, and is left out for a guest.
 */
export type MuyuServerMessage = {
  type: "merit";
  total: number;
  here: number;
  ack?: number;
  mine?: number;
};

/** A person's knocks in the current second, for the limit. */
export type KnockBudget = { start: number; used: number };

/** How many of `count` knocks at `now` count, and the budget left. */
export function takeKnocks(
  budget: KnockBudget | undefined,
  count: number,
  now: number,
) {
  const current =
    budget && now - budget.start < 1_000 ? budget : { start: now, used: 0 };
  const accepted = Math.max(
    0,
    Math.min(count, KNOCKS_PER_SECOND - current.used),
  );
  return { accepted, budget: { ...current, used: current.used + accepted } };
}

const isCount = (value: unknown, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(value) &&
  (value as number) >= 0 &&
  (value as number) <= max;

/** A frame of knocks from a browser, or null for anything else. */
export function parseMuyuClientMessage(raw: unknown): MuyuClientMessage | null {
  const data = readJsonObject(raw, FRAME_MAX);
  if (
    data?.type !== "knock" ||
    !isCount(data.count, KNOCKS_PER_FRAME) ||
    data.count === 0 ||
    !isCount(data.seq)
  ) {
    return null;
  }
  return {
    type: "knock",
    count: data.count as number,
    seq: data.seq as number,
  };
}

/** What the room sent, or null for anything the browser does not know. */
export function parseMuyuServerMessage(raw: unknown): MuyuServerMessage | null {
  const data = readJsonObject(raw, FRAME_MAX);
  if (data?.type !== "merit" || !isCount(data.total) || !isCount(data.here)) {
    return null;
  }
  const message: MuyuServerMessage = {
    type: "merit",
    total: data.total as number,
    here: data.here as number,
  };
  if (isCount(data.ack)) message.ack = data.ack as number;
  if (isCount(data.mine)) message.mine = data.mine as number;
  return message;
}
