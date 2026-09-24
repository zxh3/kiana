import { KNOCKS_PER_FRAME, type MuyuServerMessage } from "../../../../lib/muyu";

/**
 * The electronic wooden fish's side of the count, as a pure reducer.
 * Everyone's merit comes from the room; this browser's own pats show at
 * once on top of it, while they wait to be sent (`queued`) and while they
 * are on their way (`sending`), until the room's answer has them in its
 * total. So the number only ever climbs, however slow the connection.
 * `use-muyu.ts` feeds it the socket's events.
 */

export type MuyuState = {
  status: "connecting" | "open" | "offline";
  /** Everyone's merit, as the room last said; null until it has. */
  total: number | null;
  /** How many have it open, this browser included. */
  here: number;
  /** Pats not sent yet. */
  queued: number;
  /** Frames sent that the room has not answered yet. */
  sending: Array<{ seq: number; count: number }>;
  /** The number for the next frame. */
  seq: number;
  /** Pats this visit, which the screen turns into its animation. */
  pats: number;
};

export type MuyuEvent =
  | { type: "connecting" }
  | { type: "offline" }
  | { type: "pat" }
  | { type: "sent"; seq: number; count: number }
  | { type: "received"; message: MuyuServerMessage };

export const initialMuyuState: MuyuState = {
  status: "connecting",
  total: null,
  here: 0,
  queued: 0,
  sending: [],
  seq: 0,
  pats: 0,
};

export function muyuReducer(state: MuyuState, event: MuyuEvent): MuyuState {
  switch (event.type) {
    case "connecting":
      return { ...state, status: "connecting" };
    // Frames in flight when it dropped may or may not have counted; they
    // are let go rather than risk counting them twice.
    case "offline":
      return { ...state, status: "offline", sending: [] };
    case "pat":
      return { ...state, queued: state.queued + 1, pats: state.pats + 1 };
    case "sent":
      return {
        ...state,
        queued: Math.max(0, state.queued - event.count),
        sending: [...state.sending, { seq: event.seq, count: event.count }],
        seq: Math.max(state.seq, event.seq + 1),
      };
    case "received": {
      const { ack, here, total } = event.message;
      // The room answers in order, so an answer covers every frame before.
      const sending =
        ack === undefined
          ? state.sending
          : state.sending.filter((frame) => frame.seq > ack);
      return { ...state, status: "open", total, here, sending };
    }
  }
}

/** The number to show: everyone's merit, with this browser's pats on top. */
export function shownMerit(state: MuyuState) {
  if (state.total === null) return null;
  const sending = state.sending.reduce((sum, frame) => sum + frame.count, 0);
  return state.total + sending + state.queued;
}

/** The next frame to send, if any pats are waiting. */
export function nextFrame(state: MuyuState) {
  if (state.queued === 0) return null;
  return { seq: state.seq, count: Math.min(state.queued, KNOCKS_PER_FRAME) };
}

/** This browser's own merit, kept between visits. */
export function parseMerit(raw: string | null) {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}
