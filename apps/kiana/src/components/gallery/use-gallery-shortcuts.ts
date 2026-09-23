import { useEffect, useRef } from "react";

import type { Frame } from "./model";

export type ShortcutHandlers = {
  onNext: () => void;
  onOpenHelp: () => void;
  onOpenLibrary: () => void;
  onPickFrame: (frame: Frame) => void;
  onPrevious: () => void;
  onShare: () => void;
  onToggleFavorite: () => void;
  onToggleFullscreen: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
};

export const shortcutList: ReadonlyArray<{ keys: string[]; label: string }> = [
  { keys: ["Space"], label: "Play or pause" },
  { keys: ["←", "→"], label: "Previous or next" },
  { keys: ["L"], label: "Favorite" },
  { keys: ["S"], label: "Share a link" },
  { keys: ["M"], label: "Sound on or off" },
  { keys: ["G"], label: "Open the library" },
  { keys: ["F"], label: "Full screen" },
  { keys: ["1", "2", "3"], label: "Fill, backdrop, or mat" },
  { keys: ["?"], label: "Show shortcuts" },
];

const frameShortcuts: Record<string, Frame> = {
  "1": "fill",
  "2": "backdrop",
  "3": "mat",
};

/** Text fields, and widgets such as the music player that handle keys. */
function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) ||
      target.closest("[data-own-keys]") !== null)
  );
}

/**
 * Slideshow shortcuts. Disabled while a menu, dialog, or the library owns the
 * keyboard, so arrow keys and Space keep their native meaning there.
 */
export function useGalleryShortcuts(
  enabled: boolean,
  handlers: ShortcutHandlers,
) {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditable(event.target)
      ) {
        return;
      }
      const on = latest.current;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

      // Arrow keys may repeat so holding one skims through photos.
      if (key === "ArrowRight" || key === "ArrowLeft") {
        event.preventDefault();
        if (key === "ArrowRight") on.onNext();
        else on.onPrevious();
        return;
      }
      if (event.repeat) return;

      // Space always toggles playback, even when a control has focus.
      if (key === " " || key === "k") {
        event.preventDefault();
        on.onTogglePause();
        return;
      }

      const frame = frameShortcuts[key];
      const actions: Record<string, (() => void) | undefined> = {
        "?": on.onOpenHelp,
        f: on.onToggleFullscreen,
        g: on.onOpenLibrary,
        l: on.onToggleFavorite,
        m: on.onToggleMute,
        s: on.onShare,
      };
      const action = frame ? () => on.onPickFrame(frame) : actions[key];
      if (action) {
        event.preventDefault();
        action();
      }
    };

    // Some browsers activate a focused button on Space keyup even when the
    // keydown was handled, which would click it on top of toggling playback.
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === " " && !isEditable(event.target))
        event.preventDefault();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled]);
}
