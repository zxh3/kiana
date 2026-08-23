/**
 * Keyboard shortcuts, and the one list that documents them.
 *
 * Built on @tanstack/hotkeys' core manager, which is framework-agnostic — it
 * handles the parts that are easy to get wrong: platform-aware `Mod`, and not
 * firing single-letter keys while someone is typing in a field.
 *
 * Two deliberate constraints on the choice of keys:
 *
 *  - No modifiers on the pane switches. `Mod+1..4` is the conventional way to
 *    switch tabs, but browsers claim exactly that combination for their own
 *    tabs, so it would never reach us.
 *  - Nothing reaches us at all while focus is inside a pane, because a pane is
 *    a cross-origin iframe and its keystrokes belong to it. Clicking the
 *    session bar (or arriving on the page) hands focus back. The shortcuts
 *    panel says so rather than leaving people to wonder.
 */

import {
  formatForDisplay,
  getHotkeyManager,
  type Hotkey,
  type HotkeyCallback,
} from "@tanstack/hotkeys";

export interface Shortcut {
  /** Typed by the library, so an unparseable combination fails to compile. */
  keys: Hotkey;
  label: string;
  /** Which screen it belongs to, for grouping in the panel. */
  scope: "Anywhere" | "Sandboxes" | "In a sandbox";
}

/**
 * Every shortcut the app has. The panel renders this, and each screen
 * registers the handful it owns — so a shortcut cannot exist undocumented.
 */
/**
 * `Shift+/` — the `?` key. The library validates it at runtime with no
 * warnings, but its `Hotkey` union omits shifted punctuation, so this one
 * combination needs the cast.
 */
export const HELP_KEY = "Shift+/" as Hotkey;

/**
 * The palette's key. `Mod+K` is what every app with a palette uses, and it is
 * one of the few modifier combinations browsers hand to the page.
 */
export const PALETTE_KEY = "Mod+K" as const;

export const shortcuts: Shortcut[] = [
  { keys: PALETTE_KEY, label: "Command palette", scope: "Anywhere" },
  { keys: HELP_KEY, label: "Keyboard shortcuts", scope: "Anywhere" },
  { keys: "C", label: "Create a sandbox", scope: "Sandboxes" },
  { keys: "R", label: "Refresh the list", scope: "Sandboxes" },
  { keys: "1", label: "zsh pane", scope: "In a sandbox" },
  { keys: "2", label: "herdr pane", scope: "In a sandbox" },
  { keys: "3", label: "vscode pane", scope: "In a sandbox" },
  { keys: "4", label: "browser pane", scope: "In a sandbox" },
  { keys: "S", label: "Save a snapshot", scope: "In a sandbox" },
  { keys: "B", label: "Back to sandboxes", scope: "In a sandbox" },
];

/**
 * `Shift+/` is how the library spells it, but nobody thinks of it that way —
 * they press `?`.
 */
export function displayKeys(keys: Hotkey): string {
  if (keys === HELP_KEY) return "?";
  return formatForDisplay(keys);
}

/**
 * Register shortcuts for as long as the caller lives. Meant to be called
 * inside a Svelte `$effect`, whose cleanup unregisters them — so leaving a
 * screen takes its shortcuts with it.
 */
export function bindHotkeys(
  bindings: Array<[Hotkey, HotkeyCallback]>,
): () => void {
  const manager = getHotkeyManager();
  const handles = bindings.map(([keys, callback]) =>
    manager.register(keys, callback, {
      // Two screens can legitimately bind the same key; the one that is
      // mounted wins, and a warning here would only be noise.
      conflictBehavior: "replace",
    }),
  );
  return () => {
    for (const handle of handles) handle.unregister();
  };
}
