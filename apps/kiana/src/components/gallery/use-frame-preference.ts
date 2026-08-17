import { useCallback, useState } from "react";

import { type Frame, frames } from "./model";

const FRAME_KEY = "kiana.frame";

function readFrame(): Frame {
  try {
    const stored = window.localStorage.getItem(FRAME_KEY);
    const normalized = stored === "bleed" ? "fill" : stored;
    return frames.includes(normalized as Frame)
      ? (normalized as Frame)
      : "backdrop";
  } catch {
    return "backdrop";
  }
}

export function useFramePreference() {
  const [frame, setFrameState] = useState(readFrame);

  const setFrame = useCallback((nextFrame: Frame) => {
    setFrameState(nextFrame);
    try {
      window.localStorage.setItem(FRAME_KEY, nextFrame);
    } catch {
      // The visual preference still works for the current visit.
    }
  }, []);

  return [frame, setFrame] as const;
}
