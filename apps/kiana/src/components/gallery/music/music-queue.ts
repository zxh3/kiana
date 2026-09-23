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
