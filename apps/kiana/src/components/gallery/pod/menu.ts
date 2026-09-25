import type { AccountStatus } from "../account";

/**
 * The pocket player's screens, menus, and lists. Kept free of React so the
 * rules can be tested on their own.
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
  | "account"
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
 * its owner gave it. The Chat Room is joined while any of its screens
 * shows (the messages, who is online, and the viewer's name), so the
 * Online list counts people who have it open.
 */
export const screens: Record<Screen, ScreenInfo> = {
  menu: { title: "Kiana", parent: null },
  covers: { title: "Cover Flow", parent: "menu" },
  songs: { title: "Songs", parent: "menu" },
  apps: { title: "Apps", parent: "menu" },
  spinner: { title: "Finger Spinner", parent: "apps" },
  muyu: { title: "电子木鱼", parent: "apps", lang: "zh", room: "muyu" },
  chat: { title: "Chat Room", parent: "apps", room: "chat" },
  online: { title: "Online", parent: "chat", room: "chat" },
  name: { title: "Your Name", parent: "online", room: "chat" },
  settings: { title: "Settings", parent: "menu" },
  account: { title: "Account", parent: "settings" },
  now: { title: "Now Playing", parent: "menu" },
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

/**
 * Settings, named as on the original where it had the same setting. Then
 * two choose the finger spinner's looks: which spinner, and which of
 * Kiana's faces sits on its cap. Account, last, opens its own screen.
 */
export const settingsItems = [
  "shuffle",
  "repeat",
  "backlight",
  "clicker",
  "finish",
  "spinner",
  "face",
  "account",
] as const;
export type SettingsItem = (typeof settingsItems)[number];
/** The settings a press changes in place; Account opens a screen instead. */
export type ToggleSetting = Exclude<SettingsItem, "account">;

export const settingsLabels: Record<SettingsItem, string> = {
  shuffle: "Shuffle",
  repeat: "Repeat",
  backlight: "Backlight",
  clicker: "Clicker",
  finish: "Finish",
  spinner: "Spinner",
  face: "Kiana",
  account: "Account",
};

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
