import { useEffect } from "react";

import type { Frame } from "./model";

const shortcuts: Record<string, Frame> = {
  "1": "fill",
  "2": "backdrop",
  "3": "mat",
};

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
  );
}

export function useFrameShortcuts(onPick: (frame: Frame) => void) {
  useEffect(() => {
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

      const frame = shortcuts[event.key];
      if (!frame) return;

      event.preventDefault();
      onPick(frame);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onPick]);
}
