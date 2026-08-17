import { useEffect, useState } from "react";

import { getSlidePosition, SLIDE_DURATION, type SlidePosition } from "./model";

export function useSlideshow(itemCount: number) {
  const [live, setLive] = useState(() =>
    getSlidePosition(Date.now(), itemCount),
  );
  const [paused, setPaused] = useState<SlidePosition | null>(null);

  useEffect(() => {
    let timeout: number;

    const schedule = () => {
      window.clearTimeout(timeout);
      const phase = Date.now() % SLIDE_DURATION;
      timeout = window.setTimeout(sync, SLIDE_DURATION - phase + 16);
    };

    const sync = () => {
      setLive(getSlidePosition(Date.now(), itemCount));
      schedule();
    };

    const syncWhenVisible = () => {
      if (!document.hidden) sync();
    };

    schedule();
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [itemCount]);

  const pause = () => {
    setPaused((current) => current ?? getSlidePosition(Date.now(), itemCount));
  };

  const resume = () => {
    setLive(getSlidePosition(Date.now(), itemCount));
    setPaused(null);
  };

  return {
    isPaused: paused !== null,
    liveIndex: live.index,
    pause,
    position: paused ?? live,
    resume,
    touchControlsVisible: paused !== null,
  };
}
