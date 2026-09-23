import { AnimatePresence, motion } from "motion/react";

import { cx } from "../../../../lib/class-names";
import { fades } from "../../../../lib/motion";
import { cue } from "../../../../lib/sounds";
import { focusRing } from "../../control-button";
import { EqualizerIcon, PauseIcon, PlayIcon } from "../../icons";
import { Swap } from "../../swap";
import { trackArt } from "../music-track";
import type { Music } from "../use-music";

/**
 * The small player, after the square clip-on players: just the cover, a
 * thread of progress, and play or pause. A tap on the cover opens the full
 * player.
 */
export function NanoPlayer({
  music,
  onExpand,
  progress,
}: {
  music: Music;
  onExpand: () => void;
  progress: { current: number; duration: number };
}) {
  const playing = music.status === "playing";
  const { track } = music;
  const percent =
    progress.duration > 0
      ? Math.min(100, (progress.current / progress.duration) * 100)
      : 0;

  return (
    <div className="relative p-[5px]">
      <button
        aria-label={`Open the music player: ${track.title}`}
        className={cx(
          "relative block size-[78px] cursor-pointer overflow-hidden rounded-[12px] border-[1.5px] border-[#0d0d0d] bg-black",
          focusRing,
          "focus-visible:ring-offset-0",
        )}
        onClick={() => {
          cue("open");
          onExpand();
        }}
        title={`${track.title} · ${track.artist}`}
        type="button"
      >
        <AnimatePresence initial={false}>
          <motion.img
            alt=""
            animate={{ opacity: 1 }}
            className="absolute inset-0 size-full object-cover"
            draggable={false}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key={track.videoId}
            src={trackArt(track)}
            transition={fades.in}
          />
        </AnimatePresence>
        <span className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-black/65 to-transparent" />
        <span className="absolute top-1.5 left-1.5 grid size-[18px] place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
          <EqualizerIcon className="h-2.5! w-2.5! gap-px!" playing={playing} />
        </span>
        <span className="absolute inset-x-0 bottom-0 h-[2.5px] bg-white/20">
          <span
            className="block h-full bg-white transition-[width] duration-1000 ease-linear"
            style={{ width: `${percent}%` }}
          />
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgb(255_255_255/.2)_0%,transparent_40%)]"
        />
      </button>
      <button
        aria-label={playing ? "Pause the music" : "Play the music"}
        className={cx(
          "absolute right-[10px] bottom-[11px] grid size-[26px] cursor-pointer place-items-center rounded-full bg-white/90 text-black shadow-[0_2px_8px_rgb(0_0_0/.35)] transition-[scale,background-color] duration-150 hover:bg-white active:scale-90",
          focusRing,
          "focus-visible:ring-offset-0",
        )}
        onClick={() => {
          cue("press");
          music.toggle();
        }}
        title={playing ? "Pause" : "Play"}
        type="button"
      >
        <Swap id={playing ? "pause" : "play"}>
          {playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
        </Swap>
      </button>
    </div>
  );
}
