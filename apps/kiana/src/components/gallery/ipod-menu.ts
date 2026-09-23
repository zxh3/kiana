/**
 * The pocket player's screens and the arithmetic of its click wheel. Kept
 * free of React so the rules can be tested on their own.
 */

export type Screen = "menu" | "songs" | "settings" | "now";
export type ListScreen = Exclude<Screen, "now">;

export const screenTitles: Record<Screen, string> = {
  menu: "Music",
  songs: "Songs",
  settings: "Settings",
  now: "Now Playing",
};

/**
 * Where Menu goes back to. The top menu has nowhere left to go, so Menu does
 * nothing there, as on the original: pressing it repeatedly is always safe.
 */
export const parentScreen: Record<Screen, Screen | null> = {
  menu: null,
  songs: "menu",
  settings: "menu",
  now: "menu",
};

/**
 * The top menu holds only music. Putting the player away belongs to the
 * widget's own minimize and close buttons, not to the device's menus.
 */
export const menuItems = ["now", "songs", "shuffle", "settings"] as const;
export type MenuItem = (typeof menuItems)[number];

export const menuLabels: Record<MenuItem, string> = {
  now: "Now Playing",
  songs: "Songs",
  shuffle: "Shuffle Songs",
  settings: "Settings",
};

export const settingsItems = ["mode", "video", "finish", "youtube"] as const;
export type SettingsItem = (typeof settingsItems)[number];

export const settingsLabels: Record<SettingsItem, string> = {
  mode: "Play Mode",
  video: "Video",
  finish: "Finish",
  youtube: "Open on YouTube",
};

/** Rows that fit on the screen at once. */
export const VISIBLE_ROWS = 7;

/** Degrees of wheel travel per click: 24 clicks a turn, like the original. */
export const DEGREES_PER_STEP = 15;

/** The signed turn from one angle to another, in (-180, 180]. */
export function angleDelta(from: number, to: number) {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return delta;
}

/** Whole clicks in `travel`, and the travel left over toward the next one. */
export function takeSteps(travel: number, size: number) {
  const steps = Math.trunc(travel / size);
  return { steps, rest: travel - steps * size };
}

/** Lists stop at their ends rather than wrapping, as the original did. */
export function moveSelection(index: number, steps: number, length: number) {
  return Math.max(0, Math.min(length - 1, index + steps));
}

/** The first visible row, moved only as far as needed to show `selected`. */
export function scrollWindow(
  first: number,
  selected: number,
  length: number,
  rows = VISIBLE_ROWS,
) {
  const start = Math.min(first, selected, Math.max(0, length - rows));
  return Math.max(start, selected - rows + 1, 0);
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
