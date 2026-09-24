/**
 * The pocket player's screens, menus, and the arithmetic of its click wheel.
 * Kept free of React so the rules can be tested on their own.
 */

export type Screen =
  | "menu"
  | "covers"
  | "songs"
  | "apps"
  | "spinner"
  | "muyu"
  | "chat"
  | "online"
  | "name"
  | "settings"
  | "now";
/** Screens with a highlight that the wheel moves. */
export type ChoiceScreen = Exclude<
  Screen,
  "now" | "spinner" | "muyu" | "chat" | "name"
>;
/** Screens drawn as a menu list. */
export type ListScreen = Exclude<ChoiceScreen, "covers">;

/**
 * The top menu is titled with the device's name, as a real one showed the
 * name its owner gave it.
 */
export const screenTitles: Record<Screen, string> = {
  menu: "Kiana",
  covers: "Cover Flow",
  songs: "Songs",
  apps: "Apps",
  spinner: "Finger Spinner",
  muyu: "电子木鱼",
  chat: "Chat Room",
  online: "Online",
  name: "Your Name",
  settings: "Settings",
  now: "Now Playing",
};

/**
 * Where Menu goes back to. The top menu has nowhere left to go, so Menu does
 * nothing there, as on the original: pressing it repeatedly is always safe.
 */
export const parentScreen: Record<Screen, Screen | null> = {
  menu: null,
  covers: "menu",
  songs: "menu",
  apps: "menu",
  spinner: "apps",
  muyu: "apps",
  chat: "apps",
  online: "chat",
  name: "online",
  settings: "menu",
  now: "menu",
};

/**
 * The top menu, laid out as on the original: Shuffle Songs one press away,
 * Apps for the little programs, and Now Playing last. With a playlist this
 * short the song screens sit here too, rather than a level down under
 * "Music".
 * Putting the player away belongs to the widget's own minimize and close
 * buttons, not to the device's menus.
 */
export const menuItems = [
  "covers",
  "songs",
  "shuffle",
  "apps",
  "settings",
  "now",
] as const;
export type MenuItem = (typeof menuItems)[number];

export const menuLabels: Record<MenuItem, string> = {
  covers: "Cover Flow",
  songs: "Songs",
  shuffle: "Shuffle Songs",
  apps: "Apps",
  settings: "Settings",
  now: "Now Playing",
};

/** Menu items that open another screen, drawn with a chevron. */
export const menuOpens: Record<MenuItem, boolean> = {
  covers: true,
  songs: true,
  shuffle: false,
  apps: true,
  settings: true,
  now: true,
};

/**
 * The little apps, where the original kept its games under Extras: named
 * Apps here, since they are no longer only games.
 */
export const appItems = ["spinner", "chat", "muyu"] as const;
export type AppItem = (typeof appItems)[number];

export const appLabels: Record<AppItem, string> = {
  spinner: "Finger Spinner",
  chat: "Chat Room",
  muyu: "电子木鱼",
};

/** The language of each app's name, where it is not English. */
export const appLangs: Partial<Record<AppItem, string>> = { muyu: "zh" };

/**
 * The Chat Room's screens: the messages, who is online, and the viewer's
 * name. The room is joined while one of them shows.
 */
export const chatScreens: ReadonlySet<Screen> = new Set([
  "chat",
  "online",
  "name",
]);

/**
 * Settings, named as on the original where it had the same setting. The
 * last two choose the finger spinner's looks: which spinner, and which of
 * Kiana's faces sits on its cap.
 */
export const settingsItems = [
  "shuffle",
  "repeat",
  "backlight",
  "clicker",
  "finish",
  "spinner",
  "face",
] as const;
export type SettingsItem = (typeof settingsItems)[number];

export const settingsLabels: Record<SettingsItem, string> = {
  shuffle: "Shuffle",
  repeat: "Repeat",
  backlight: "Backlight",
  clicker: "Clicker",
  finish: "Finish",
  spinner: "Spinner",
  face: "Kiana",
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

/**
 * Which of the wheel's four buttons lies at an angle, in degrees clockwise
 * from the right (as `Math.atan2` gives it on screen): each owns a quarter
 * of the ring around its compass point.
 */
export function wheelZoneAt(angle: number) {
  const a = angleDelta(0, angle);
  if (a > -135 && a <= -45) return "menu";
  if (a > -45 && a <= 45) return "next";
  if (a > 45 && a <= 135) return "play";
  return "previous";
}

/** Whole clicks in `travel`, and the travel left over toward the next one. */
export function takeSteps(travel: number, size: number) {
  const steps = Math.trunc(travel / size);
  return { steps, rest: travel - steps * size };
}

/** Lists stop at their ends rather than wrapping, as the original did. */
export function moveSelection(index: number, steps: number, length: number) {
  return clamp(index + steps, 0, length - 1);
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
