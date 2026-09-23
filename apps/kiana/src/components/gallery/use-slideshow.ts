import { useCallback, useEffect, useRef, useState } from "react";

import type { GalleryAsset } from "../../data/photos";
import type { Order } from "./model";
import {
  advance,
  canRetreat,
  createPlayback,
  currentIndex,
  jump,
  type Playback,
  retarget,
  retreat,
  upcoming,
} from "./playback";

type SlideshowState = {
  members: ReadonlyArray<number>;
  order: Order;
  playback: Playback;
};

export function useSlideshow({
  assets,
  duration,
  initialIndex,
  members,
  order,
  paused,
  resumeIndex,
}: {
  assets: ReadonlyArray<GalleryAsset>;
  duration: number;
  /** A shared photo to open first; wins over `resumeIndex`. */
  initialIndex?: number;
  members: ReadonlyArray<number>;
  order: Order;
  paused: boolean;
  /** Where date order last left the current collection. */
  resumeIndex?: number;
}) {
  const [state, setState] = useState<SlideshowState>(() => ({
    members,
    order,
    playback: createPlayback({ members, order }, initialIndex ?? resumeIndex),
  }));

  // Adopt a new collection or order during render, before anything paints.
  if (state.members !== members || state.order !== order) {
    setState({
      members,
      order,
      playback: retarget(state.playback, { members, order }, resumeIndex),
    });
  }

  const next = useCallback(() => {
    setState((current) => ({
      ...current,
      playback: advance(current.playback, current),
    }));
  }, []);

  const previous = useCallback(() => {
    setState((current) => ({
      ...current,
      playback: retreat(current.playback, current),
    }));
  }, []);

  const jumpTo = useCallback((index: number) => {
    setState((current) => ({
      ...current,
      playback: jump(current.playback, current, index),
    }));
  }, []);

  const { playback } = state;
  const index = currentIndex(playback);
  const timed = assets[index]?.type !== "video";

  // Pausing keeps the time already spent on a slide; resuming spends the rest.
  const remaining = useRef({ slide: -1, duration, ms: duration });
  useEffect(() => {
    if (!timed || paused) return;
    if (
      remaining.current.slide !== playback.slide ||
      remaining.current.duration !== duration
    ) {
      remaining.current = { slide: playback.slide, duration, ms: duration };
    }
    const startedAt = performance.now();
    const timeout = window.setTimeout(next, remaining.current.ms);
    return () => {
      window.clearTimeout(timeout);
      remaining.current.ms = Math.max(
        0,
        remaining.current.ms - (performance.now() - startedAt),
      );
    };
  }, [duration, next, paused, playback.slide, timed]);

  return {
    canGoBack: canRetreat(playback, state),
    index,
    jumpTo,
    next,
    previous,
    previousIndex: playback.previous,
    slide: playback.slide,
    upcoming: upcoming(playback, 2),
  };
}
