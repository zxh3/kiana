export const playModes = ["all", "one", "shuffle"] as const;
export type PlayMode = (typeof playModes)[number];

export const playModeLabels: Record<PlayMode, string> = {
  all: "Repeat all",
  one: "Repeat one",
  shuffle: "Shuffle",
};

export function parsePlayMode(raw: string | null): PlayMode {
  return playModes.includes(raw as PlayMode) ? (raw as PlayMode) : "all";
}

export function nextPlayMode(mode: PlayMode): PlayMode {
  return playModes[(playModes.indexOf(mode) + 1) % playModes.length];
}

/**
 * The track after `index`. Repeat all and repeat one both step forward when
 * asked (repeat one only replays when a song ends on its own). Shuffle picks
 * any other track.
 */
export function nextTrackIndex(
  index: number,
  length: number,
  mode: PlayMode,
  random: () => number = Math.random,
) {
  if (length < 2) return index;
  if (mode === "shuffle") {
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
