import { readStorage } from "../use-stored-state";

/**
 * Shuffle and repeat are separate settings, as on the classic players:
 * - repeat all, shuffle off: the list in order, looping (列表循环)
 * - repeat one: the song again when it ends (单曲循环)
 * - shuffle on: any other song next (随机播放)
 */
export type Repeat = "all" | "one";

/** The single setting these replaced, read so a saved choice carries over. */
const LEGACY_MODE_KEY = "kiana.music-mode";

export function parseShuffle(raw: string | null) {
  if (raw === "true" || raw === "false") return raw === "true";
  return readStorage(LEGACY_MODE_KEY) === "shuffle";
}

export function parseRepeat(raw: string | null): Repeat {
  if (raw === "all" || raw === "one") return raw;
  return readStorage(LEGACY_MODE_KEY) === "one" ? "one" : "all";
}

/**
 * The track after `index` when the viewer asks for the next one, or a song
 * ends without repeat one: the next in the list, wrapping, or with shuffle
 * any other track.
 */
export function nextTrackIndex(
  index: number,
  length: number,
  shuffle: boolean,
  random: () => number = Math.random,
) {
  if (length < 2) return index;
  if (shuffle) {
    const pick = Math.floor(
      Math.min(random(), 1 - Number.EPSILON) * (length - 1),
    );
    return pick >= index ? pick + 1 : pick;
  }
  return (index + 1) % length;
}

export function previousTrackIndex(index: number, length: number) {
  return length < 2 ? index : (index - 1 + length) % length;
}

/** How many shuffled songs previous can step back through. */
const SHUFFLE_MEMORY = 50;
/** Past this many seconds, previous restarts the song instead. */
const RESTART_AFTER = 3;

/**
 * The songs to step back through, moving on from `current`: with shuffle,
 * it joins them, the last ones kept; in order, previous needs no memory.
 */
export function rememberTrack(
  history: ReadonlyArray<number>,
  current: number,
  shuffle: boolean,
): ReadonlyArray<number> {
  return shuffle ? [...history, current].slice(-SHUFFLE_MEMORY) : history;
}

/**
 * What previous does, as on the classic players: past the first few
 * seconds it starts the song again; otherwise it goes back, with shuffle
 * to the song it came from, if it remembers one, or else up the list.
 */
export function previousMove({
  elapsed,
  history,
  index,
  length,
  shuffle,
}: {
  elapsed: number;
  history: ReadonlyArray<number>;
  index: number;
  length: number;
  shuffle: boolean;
}): { restart: true } | { index: number; history: ReadonlyArray<number> } {
  if (elapsed > RESTART_AFTER) return { restart: true };
  const remembered = shuffle ? history.at(-1) : undefined;
  if (remembered !== undefined) {
    return { index: remembered, history: history.slice(0, -1) };
  }
  return { index: previousTrackIndex(index, length), history };
}

/**
 * Where to go after a song refuses to play: the next in list order, even
 * with shuffle, so every song is tried once; null once all have failed.
 */
export function afterFailure(index: number, length: number, failures: number) {
  return failures >= length ? null : (index + 1) % length;
}
