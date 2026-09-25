import type { AccountStatus } from "../account";

/**
 * The pocket player's screens, menus, and lists. Kept free of React so the
 * rules can be tested on their own.
 */

export type Screen =
  | "menu"
  | "music"
  | "covers"
  | "songs"
  | "apps"
  | "spinner"
  | "muyu"
  | "chat"
  | "online"
  | "name"
  | "settings"
  | "account"
  | "looks"
  | "now";
/**
 * Screens an app draws itself, where the wheel and the centre button
 * belong to the app rather than to a list.
 */
export type AppScreen = "spinner" | "muyu" | "chat" | "name";
/** Screens with a highlight that the wheel moves. */
export type ChoiceScreen = Exclude<Screen, "now" | AppScreen>;
/** Screens drawn as a menu list. */
export type ListScreen = Exclude<ChoiceScreen, "covers">;

type ScreenInfo = {
  title: string;
  /**
   * Where Menu goes back to. The top menu has nowhere left to go, so Menu
   * does nothing there, as on the original: pressing it repeatedly is
   * always safe.
   */
  parent: Screen | null;
  /** The language of its title, where it is not English. */
  lang?: string;
  /** The live app whose connection stays open while it shows. */
  room?: "chat" | "muyu";
};

/**
 * Every screen: its title, where Menu goes back to, and the rest. The top
 * menu is titled with the device's name, as a real one showed the name
 * its owner gave it. Chat's room is joined while any of its screens
 * shows (the messages, who is online, and the viewer's name), so the
 * Online list counts people who have it open.
 */
export const screens: Record<Screen, ScreenInfo> = {
  menu: { title: "Kiana", parent: null },
  music: { title: "Music", parent: "menu" },
  covers: { title: "Cover Flow", parent: "music" },
  songs: { title: "Songs", parent: "music" },
  apps: { title: "Apps", parent: "menu" },
  spinner: { title: "Finger Spinner", parent: "apps" },
  muyu: { title: "电子木鱼", parent: "apps", lang: "zh", room: "muyu" },
  chat: { title: "Chat", parent: "apps", room: "chat" },
  online: { title: "Online", parent: "chat", room: "chat" },
  name: { title: "Your Name", parent: "online", room: "chat" },
  settings: { title: "Settings", parent: "menu" },
  account: { title: "Account", parent: "settings" },
  looks: { title: "Finger Spinner", parent: "settings" },
  now: { title: "Now Playing", parent: "menu" },
};

/**
 * The top menu, laid out as on the original: Music, Apps (where the
 * original kept its games under Extras), and Settings, each a level down,
 * then Shuffle Songs one press away and Now Playing last. Putting the
 * player away belongs to the widget's own minimize and close buttons, not
 * to the device's menus.
 */
export const menuItems = [
  "music",
  "apps",
  "settings",
  "shuffle",
  "now",
] as const;
export type MenuItem = (typeof menuItems)[number];

export const menuLabels: Record<MenuItem, string> = {
  music: "Music",
  apps: "Apps",
  settings: "Settings",
  shuffle: "Shuffle Songs",
  now: "Now Playing",
};

/** Menu items that open another screen, drawn with a chevron. */
export const menuOpens: Record<MenuItem, boolean> = {
  music: true,
  apps: true,
  settings: true,
  shuffle: false,
  now: true,
};

/** Music: the songs as covers to flip through, or as a list. */
export const musicItems = ["covers", "songs"] as const;
export type MusicItem = (typeof musicItems)[number];

/**
 * The little apps, where the original kept its games under Extras: named
 * Apps here, since they are no longer only games.
 */
export const appItems = ["spinner", "chat", "muyu"] as const;
export type AppItem = (typeof appItems)[number];

/**
 * Settings, named as on the original where it had the same setting.
 * Account comes first, as the one who is signed in does on a phone, and
 * the finger spinner's looks have a screen of their own, last.
 */
export const settingsItems = [
  "account",
  "shuffle",
  "repeat",
  "backlight",
  "clicker",
  "finish",
  "looks",
] as const;
export type SettingsItem = (typeof settingsItems)[number];

export const settingsLabels: Record<SettingsItem, string> = {
  account: "Account",
  shuffle: "Shuffle",
  repeat: "Repeat",
  backlight: "Backlight",
  clicker: "Clicker",
  finish: "Finish",
  looks: "Finger Spinner",
};

/**
 * The finger spinner's looks, under Settings: which spinner, and which of
 * Kiana's faces sits on its cap.
 */
export const looksItems = ["spinner", "face"] as const;
export type LooksItem = (typeof looksItems)[number];

export const looksLabels: Record<LooksItem, string> = {
  spinner: "Spinner",
  face: "Kiana",
};

/** Settings a press changes in place, rather than opening a screen. */
export type ToggleSetting =
  | Exclude<SettingsItem, "account" | "looks">
  | LooksItem;

/**
 * The Account screen's rows, which depend on whether the viewer is signed
 * in: a way in for a guest; for someone signed in, who they are and a way
 * out; otherwise a word on why there is neither.
 */
export type AccountItem =
  | "checking"
  | "unavailable"
  | "signIn"
  | "member"
  | "signOut";

export function accountItems(status: AccountStatus): AccountItem[] {
  switch (status) {
    case "checking":
      return ["checking"];
    case "unavailable":
      return ["unavailable"];
    case "guest":
      return ["signIn"];
    case "member":
      return ["member", "signOut"];
  }
}

export const accountLabels: Record<Exclude<AccountItem, "member">, string> = {
  checking: "Checking…",
  unavailable: "Not Available",
  signIn: "Sign In with Google",
  signOut: "Sign Out",
};

/** Rows that fit on the screen at once. */
export const VISIBLE_ROWS = 7;

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
