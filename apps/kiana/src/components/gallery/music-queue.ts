import { shuffledIndexes } from "./slideshow-order";

/**
 * all: 列表循环, the list in order, looping back to the first song.
 * one: 单曲循环, the current song again and again.
 * shuffle: 随机播放, every song once in a random order, then a new order.
 */
export const playModes = ["all", "one", "shuffle"] as const;
export type PlayMode = (typeof playModes)[number];

export const playModeNames: Record<PlayMode, { zh: string; en: string }> = {
  all: { zh: "列表循环", en: "Repeat all" },
  one: { zh: "单曲循环", en: "Repeat one" },
  shuffle: { zh: "随机播放", en: "Shuffle" },
};

export function parsePlayMode(raw: string | null): PlayMode {
  return playModes.includes(raw as PlayMode) ? (raw as PlayMode) : "all";
}

export function nextInOrder(index: number, length: number) {
  return length < 2 ? index : (index + 1) % length;
}

export function previousInOrder(index: number, length: number) {
  return length < 2 ? index : (index - 1 + length) % length;
}

/** A shuffled round of every track except `current`. */
export function shuffleBag(
  length: number,
  current: number,
  random: () => number = Math.random,
) {
  const others = Array.from({ length }, (_, index) => index).filter(
    (index) => index !== current,
  );
  return shuffledIndexes(others.length, random).map((index) => others[index]);
}

export type AfterEnd =
  | { kind: "repeat" }
  | { kind: "play"; index: number }
  | { kind: "shuffle" };

/** What happens when a song ends on its own. */
export function afterSongEnds(
  index: number,
  length: number,
  mode: PlayMode,
): AfterEnd {
  if (mode === "one") return { kind: "repeat" };
  if (mode === "shuffle") return { kind: "shuffle" };
  return { kind: "play", index: nextInOrder(index, length) };
}
