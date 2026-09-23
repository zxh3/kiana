import { useSyncExternalStore } from "react";

import { cx } from "../../lib/class-names";
import type { ProgressChannel } from "./progress-channel";

/**
 * Timed slides animate in CSS so pausing freezes the bar exactly where the
 * slide timer stopped. Videos report their own progress.
 */
export function ProgressBar({
  duration,
  mat,
  paused,
  slide,
  timed,
  video,
}: {
  duration: number;
  mat: boolean;
  paused: boolean;
  slide: number;
  timed: boolean;
  video: ProgressChannel;
}) {
  const videoProgress = useSyncExternalStore(
    video.subscribe,
    video.get,
    () => 0,
  );
  return (
    <div
      aria-hidden="true"
      className={cx(
        "absolute inset-x-0 bottom-0 z-20 h-0.5 overflow-hidden transition-colors duration-500",
        mat ? "bg-ink/10" : "bg-paper/10",
      )}
    >
      <div
        className={cx(
          "h-full w-full origin-left will-change-transform",
          mat ? "bg-ink/38" : "bg-paper/55",
        )}
        key={`${slide}-${duration}-${timed}`}
        style={
          timed
            ? {
                animation: `gallery-progress ${duration}ms linear both`,
                animationPlayState: paused ? "paused" : "running",
              }
            : { transform: `scaleX(${videoProgress})` }
        }
      />
    </div>
  );
}
