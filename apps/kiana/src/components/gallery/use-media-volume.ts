import { type RefObject, useEffect } from "react";

/**
 * Keeps a video's volume at the viewer's level for clip sound. Set after
 * every render, so it also reaches a video element that mounts later.
 * (iOS keeps media volume under the hardware buttons and ignores this.)
 */
export function useMediaVolume(
  ref: RefObject<HTMLMediaElement | null>,
  volume: number,
) {
  useEffect(() => {
    if (ref.current && ref.current.volume !== volume) {
      ref.current.volume = volume;
    }
  });
}
