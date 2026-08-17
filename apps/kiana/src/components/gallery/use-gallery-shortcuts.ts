import { useEffect } from "react";

import type { Frame } from "./model";

const frameShortcuts: Record<string, Frame> = {
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

export function useGalleryShortcuts({
  onPickFrame,
  onToggleMute,
}: {
  onPickFrame: (frame: Frame) => void;
  onToggleMute: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditable(event.target)
      ) {
        return;
      }

      const frame = frameShortcuts[event.key];
      if (frame) {
        event.preventDefault();
        onPickFrame(frame);
        return;
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        onToggleMute();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onPickFrame, onToggleMute]);
}
