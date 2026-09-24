import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { cx } from "../../../../../lib/class-names";
import { fades } from "../../../../../lib/motion";
import { type Track, trackArt } from "../../music-track";
import { type AppItem, appItems, type MenuItem } from "../menu";
import { SpinnerIcon, type SpinnerLooks } from "./finger-spinner";

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

/** Each app's icon, as a tile on the Apps preview. */
function AppTile({ app, looks }: { app: AppItem; looks: SpinnerLooks }) {
  return (
    <div className="flex flex-col items-center gap-[3px]">
      <div
        className={cx(
          "grid size-[34px] place-items-center overflow-hidden rounded-[9px] shadow-[0_1px_2px_rgb(0_0_0/.3),inset_0_1px_0_rgb(255_255_255/.6)]",
          appTileBackgrounds[app],
        )}
      >
        {app === "spinner" ? (
          <SpinnerIcon looks={looks} size={30} />
        ) : (
          <ChatBubble />
        )}
      </div>
      <span className="text-[8.5px] leading-none font-semibold text-[#3d4652]">
        {appTileLabels[app]}
      </span>
    </div>
  );
}

const appTileBackgrounds: Record<AppItem, string> = {
  spinner: "bg-[linear-gradient(180deg,#ffffff_0%,#dfe4ea_100%)]",
  chat: "bg-[linear-gradient(180deg,#7cc8ff_0%,#2d7ae3_100%)]",
};

/** Short enough to sit under a tile. */
const appTileLabels: Record<AppItem, string> = {
  spinner: "Spinner",
  chat: "Chat",
};

/** A speech bubble with three dots, for the Chat Room's tile. */
function ChatBubble() {
  return (
    <svg aria-hidden="true" height="20" viewBox="0 0 20 20" width="20">
      <path
        d="M10 3.2c-4.3 0-7.3 2.6-7.3 5.8 0 1.9 1 3.5 2.7 4.6l-.7 2.9 3.2-1.9c.7.2 1.4.2 2.1.2 4.3 0 7.3-2.6 7.3-5.8S14.3 3.2 10 3.2Z"
        fill="#ffffff"
      />
      {[6.6, 10, 13.4].map((cx) => (
        <circle cx={cx} cy="9" fill="#2d7ae3" key={cx} r="1.05" />
      ))}
    </svg>
  );
}

/**
 * The apps, as tiles on a home screen: the finger spinner (in the looks
 * chosen in Settings, turning slowly) and the Chat Room.
 */
function Apps({ looks }: { looks: SpinnerLooks }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[linear-gradient(160deg,#f4f7fb_0%,#c9d3df_100%)]">
      {appItems.map((app) => (
        <AppTile app={app} key={app} looks={looks} />
      ))}
    </div>
  );
}

/**
 * The right half of the top menu, which changes with the highlighted item
 * as on the original: the covers for Cover Flow, the playing song's cover
 * drifting for Songs and Now Playing, covers dealt at random for Shuffle
 * Songs, the apps' icons for Apps, and a gear for Settings.
 */
export function MenuPreview({
  index,
  item,
  looks,
  playlist,
}: {
  index: number;
  item: MenuItem;
  /** The finger spinner's looks, for its icon under Apps. */
  looks: SpinnerLooks;
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
          ) : item === "apps" ? (
            <Apps looks={looks} />
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
