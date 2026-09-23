import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { fades } from "../../../../../lib/motion";
import { type Track, trackArt } from "../../music-track";
import type { MenuItem } from "../menu";

/** How long each cover shows while Shuffle Songs is highlighted. */
const SHUFFLE_EVERY = 1_400;

function Cover({ track, pan }: { track: Track; pan?: boolean }) {
  return (
    <img
      alt=""
      className={
        pan
          ? "absolute inset-0 size-full animate-pod-pan object-cover motion-reduce:animate-none"
          : "absolute inset-0 size-full object-cover"
      }
      draggable={false}
      src={trackArt(track)}
    />
  );
}

/** Four covers, starting from the one playing: the whole collection. */
function Mosaic({
  index,
  playlist,
}: {
  index: number;
  playlist: ReadonlyArray<Track>;
}) {
  const covers = Array.from(
    { length: Math.min(4, playlist.length) },
    (_, offset) => playlist[(index + offset) % playlist.length],
  );
  return (
    <div className="absolute inset-0 grid grid-cols-2 gap-px bg-black">
      {covers.map((track) => (
        <div className="relative overflow-hidden" key={track.videoId}>
          <Cover track={track} />
        </div>
      ))}
    </div>
  );
}

/** Covers dealt one after another in no particular order. */
function Shuffle({ playlist }: { playlist: ReadonlyArray<Track> }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (playlist.length < 2) return;
    const timer = window.setInterval(() => {
      setShown((current) => {
        const next = Math.floor(Math.random() * (playlist.length - 1));
        return next >= current ? next + 1 : next;
      });
    }, SHUFFLE_EVERY);
    return () => window.clearInterval(timer);
  }, [playlist.length]);
  const track = playlist[shown];
  return (
    <AnimatePresence initial={false}>
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="absolute inset-0"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0, scale: 1.06 }}
        key={track.videoId}
        transition={fades.in}
      >
        <Cover track={track} />
      </motion.div>
    </AnimatePresence>
  );
}

function Gear() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(160deg,#eef1f5_0%,#c3cad3_100%)]">
      <svg
        aria-hidden="true"
        className="drop-shadow-[0_1px_1px_rgb(255_255_255/.8)]"
        fill="none"
        height="46"
        viewBox="0 0 46 46"
        width="46"
      >
        {/* Teeth drawn as a thick dashed ring around a hub. */}
        <circle
          cx="23"
          cy="23"
          r="15"
          stroke="#7d8793"
          strokeDasharray="5.9 5.9"
          strokeWidth="7"
        />
        <circle cx="23" cy="23" fill="#8c96a2" r="13" />
        <circle cx="23" cy="23" fill="#dfe4ea" r="5" />
      </svg>
    </div>
  );
}

/**
 * The right half of the top menu, which changes with the highlighted item
 * as on the original: the covers for Cover Flow, the playing song's cover
 * drifting for Songs and Now Playing, covers dealt at random for Shuffle
 * Songs, and a gear for Settings.
 */
export function MenuPreview({
  index,
  item,
  playlist,
}: {
  index: number;
  item: MenuItem;
  playlist: ReadonlyArray<Track>;
}) {
  const track = playlist[index];
  return (
    <div className="relative h-full overflow-hidden border-l border-[#9d9d9d] bg-black">
      <AnimatePresence initial={false}>
        <motion.div
          animate={{ opacity: 1 }}
          className="absolute inset-0"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={item === "now" ? "songs" : item}
          transition={fades.in}
        >
          {item === "covers" ? (
            <Mosaic index={index} playlist={playlist} />
          ) : item === "shuffle" ? (
            <Shuffle playlist={playlist} />
          ) : item === "settings" ? (
            <Gear />
          ) : (
            <Cover key={track.videoId} pan track={track} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
