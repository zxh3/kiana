import { useCallback, useEffect, useState } from "react";

import type { GalleryAsset } from "../../data/photos";
import { SLIDE_DURATION } from "./model";
import { shuffledIndexes, upcomingIndexes } from "./slideshow-order";

type Playback = {
  cursor: number;
  nextOrder: number[];
  order: number[];
  previousIndex: number;
};

function createPlayback(length: number): Playback {
  const order = shuffledIndexes(length);
  const previousIndex = order.at(-1) ?? 0;
  return {
    cursor: 0,
    nextOrder: shuffledIndexes(length, Math.random, previousIndex),
    order,
    previousIndex,
  };
}

export function useSlideshow(assets: ReadonlyArray<GalleryAsset>) {
  const [playback, setPlayback] = useState(() => createPlayback(assets.length));
  const index = playback.order[playback.cursor] ?? 0;
  const activeAsset = assets[index];
  const activeId = activeAsset?.id;
  const usesTimer = activeAsset?.type !== "video";

  const advance = useCallback(() => {
    setPlayback((current) => {
      const previousIndex = current.order[current.cursor] ?? 0;
      if (current.cursor < current.order.length - 1) {
        return {
          ...current,
          cursor: current.cursor + 1,
          previousIndex,
        };
      }

      const order = current.nextOrder;
      return {
        cursor: 0,
        nextOrder: shuffledIndexes(assets.length, Math.random, order.at(-1)),
        order,
        previousIndex,
      };
    });
  }, [assets.length]);

  useEffect(() => {
    if (!usesTimer || !activeId) return;
    const timeout = window.setTimeout(advance, SLIDE_DURATION);
    return () => window.clearTimeout(timeout);
  }, [activeId, advance, usesTimer]);

  return {
    advance,
    index,
    previousIndex: playback.previousIndex,
    upcomingIndexes: upcomingIndexes(
      playback.order,
      playback.nextOrder,
      playback.cursor,
      2,
    ),
  };
}
