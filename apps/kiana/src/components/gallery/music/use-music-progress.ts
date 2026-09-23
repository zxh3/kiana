import { useEffect, useState } from "react";

import type { Music } from "./use-music";

/** Polls the song clock, re-rendering only the player and only on change. */
export function useMusicProgress(
  read: Music["readProgress"],
  interval: number | null,
) {
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  useEffect(() => {
    if (interval === null) return;
    const tick = () =>
      setProgress((previous) => {
        const next = read();
        return Math.abs(next.current - previous.current) < 0.2 &&
          next.duration === previous.duration
          ? previous
          : next;
      });
    tick();
    const timer = window.setInterval(tick, interval);
    return () => window.clearInterval(timer);
  }, [interval, read]);
  return progress;
}
