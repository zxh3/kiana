import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { cx } from "../../lib/class-names";
import { fades, springs } from "../../lib/motion";
import { cue } from "../../lib/sounds";
import { focusRing } from "./control-button";
import {
  CloseIcon,
  EqualizerIcon,
  ExternalIcon,
  MinimizeIcon,
  MusicNoteIcon,
  PauseIcon,
  PlayIcon,
} from "./icons";
import { finishStyles, parseFinish } from "./ipod-finishes";
import { type Corner, parseCorner, parsePlayerSize } from "./music-layout";
import { trackArt, trackUrl } from "./music-track";
import {
  BODY_PADDING,
  glassFrame,
  PocketPlayer,
  videoFrame,
} from "./pocket-player";
import { Swap } from "./swap";
import { useCornerDrag } from "./use-corner-drag";
import { useMediaQuery } from "./use-media-query";
import type { Music, MusicStatus } from "./use-music";
import { useStoredState } from "./use-stored-state";

const SIZE_KEY = "kiana.music-size";
const CORNER_KEY = "kiana.music-corner";
const FINISH_KEY = "kiana.music-finish";
const PHONE_QUERY = "(max-width: 639px)";

const statusLabels: Record<MusicStatus, string> = {
  idle: "Music",
  loading: "Loading",
  playing: "Playing",
  paused: "Paused",
  blocked: "Tap the video",
  error: "Unavailable",
};

/** The top-bar switch: starts the music, then pauses and resumes it. */
export function MusicButton({ music }: { music: Music }) {
  const playing = music.status === "playing";
  const label =
    music.status === "idle"
      ? `Play background music: ${music.track.title}`
      : playing
        ? `Pause ${music.track.title}`
        : `Play ${music.track.title}`;

  return (
    <button
      aria-label={label}
      aria-pressed={music.status === "idle" ? undefined : playing}
      className={cx(
        "glass flex h-10 cursor-pointer items-center gap-2 rounded-full px-3 transition-[color,background-color] duration-200 hover:bg-night/70 hover:text-paper sm:pr-4 sm:pl-3.5",
        playing ? "text-paper" : "text-paper/85",
        focusRing,
      )}
      onClick={() => {
        cue("press");
        music.toggle();
      }}
      onFocus={music.preload}
      onPointerEnter={music.preload}
      title={label}
      type="button"
    >
      <Swap id={music.status === "idle" ? "note" : "bars"}>
        {music.status === "idle" ? (
          <MusicNoteIcon size={17} />
        ) : (
          <EqualizerIcon playing={playing} />
        )}
      </Swap>
      <span className="label max-sm:sr-only">{statusLabels[music.status]}</span>
    </button>
  );
}

/**
 * Where each corner sits: clear of the top bar, the dock, and the caption
 * (which hangs bottom-left on wide screens), and inside the safe areas.
 */
const cornerClasses: Record<Corner, string> = {
  "top-left":
    "top-[calc(max(16px,env(safe-area-inset-top))+60px)] left-[max(12px,env(safe-area-inset-left))] sm:top-[84px] sm:left-7",
  "top-right":
    "top-[calc(max(16px,env(safe-area-inset-top))+60px)] right-[max(12px,env(safe-area-inset-right))] sm:top-[84px] sm:right-7",
  "bottom-left":
    "bottom-[calc(max(16px,env(safe-area-inset-bottom))+76px)] left-[max(12px,env(safe-area-inset-left))] sm:bottom-24 sm:left-7 lg:bottom-32",
  "bottom-right":
    "bottom-[calc(max(16px,env(safe-area-inset-bottom))+76px)] right-[max(12px,env(safe-area-inset-right))] sm:bottom-24 sm:right-7 lg:bottom-6 lg:data-raised:bottom-[92px] xl:data-raised:bottom-6",
};

/** Polls the song clock, re-rendering only the player and only on change. */
function useMusicProgress(
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

/**
 * The small player, after the square clip-on players: just the cover, a
 * thread of progress, and play or pause. A tap on the cover opens the full
 * player.
 */
function NanoPlayer({
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

/**
 * The now-playing widget, above the photos, menus, and library, made like
 * the pocket music players of the 2000s: an aluminium body, a colour screen
 * with menus, and a click wheel. Minimized, it becomes a small square player
 * showing the cover.
 *
 * On wider screens it can be dragged to any corner, where it stays; on
 * phones the full player rises from the bottom edge.
 *
 * YouTube's player stays mounted throughout, so playback never stops,
 * hidden until needed. It covers the screen when YouTube needs a tap or a
 * sign-in, or when the video is turned on in Settings. Hiding a playing
 * embed goes against YouTube's API policies (III.I.9); that trade-off was
 * the site owner's choice.
 */
export function MusicPlayer({
  music,
  raised,
}: {
  music: Music;
  raised: boolean;
}) {
  const [videoOpen, setVideoOpen] = useState(false);
  const [size, setSize] = useStoredState(SIZE_KEY, parsePlayerSize);
  const [corner, setCorner] = useStoredState(CORNER_KEY, parseCorner);
  const [finish, setFinish] = useStoredState(FINISH_KEY, parseFinish);
  const phone = useMediaQuery(PHONE_QUERY);
  const drag = useCornerDrag<HTMLElement>({
    corner,
    onCornerChange: setCorner,
  });

  const idle = music.status === "idle";
  const needsVideo = music.status === "blocked" || music.status === "error";
  const mini = size === "mini" && !needsVideo;
  const docked = phone && !mini;
  const showVideo = !mini && (videoOpen || needsVideo);
  const progress = useMusicProgress(
    music.readProgress,
    idle ? null : mini ? 1_000 : 250,
  );
  const { track } = music;

  return (
    <AnimatePresence>
      {idle ? null : (
        <aside
          aria-label="Music"
          key="music"
          className={cx(
            "fixed z-50 transition-[bottom] duration-500 ease-soft",
            docked
              ? "inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] mx-auto flex w-fit flex-col items-center"
              : cx(
                  "touch-none select-none",
                  cornerClasses[corner],
                  drag.dragging ? "cursor-grabbing" : "cursor-grab",
                ),
          )}
          data-raised={raised || undefined}
          ref={drag.ref}
          title={docked || drag.dragging ? undefined : "Drag to move"}
          {...(docked ? {} : drag.handlers)}
        >
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={cx(
              "group relative isolate transition-[scale,box-shadow] duration-300 ease-soft",
              drag.dragging && "scale-[1.03]",
            )}
            exit={{ opacity: 0, y: 10, scale: 0.96, transition: fades.out }}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            layout
            style={{
              ...finishStyles[finish],
              backgroundImage: "var(--pod-body)",
              borderRadius: mini ? 17 : 32,
              padding: mini ? 0 : BODY_PADDING,
              width: mini ? undefined : glassFrame.width + BODY_PADDING * 2,
              boxShadow: drag.dragging
                ? "inset 0 1px 0 var(--pod-rim), inset 0 -1px 1px rgb(0 0 0 / 0.18), 0 34px 80px -24px rgb(0 0 0 / 0.85)"
                : "inset 0 1px 0 var(--pod-rim), inset 0 -1px 1px rgb(0 0 0 / 0.18), 0 22px 56px -20px rgb(0 0 0 / 0.75)",
            }}
            transition={springs.gentle}
          >
            {/* The fine grain of brushed aluminium. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-45 [background-image:repeating-linear-gradient(90deg,rgb(255_255_255/.07)_0_1px,transparent_1px_3px)]"
            />

            <AnimatePresence initial={false} mode="popLayout">
              {mini ? (
                <motion.div
                  animate={{
                    opacity: 1,
                    transition: { ...fades.in, delay: 0.08 },
                  }}
                  exit={{ opacity: 0, transition: fades.out }}
                  initial={{ opacity: 0 }}
                  key="nano"
                  layout="position"
                >
                  <NanoPlayer
                    music={music}
                    onExpand={() => setSize("full")}
                    progress={progress}
                  />
                </motion.div>
              ) : (
                <motion.div
                  animate={{
                    opacity: 1,
                    transition: { ...fades.in, delay: 0.08 },
                  }}
                  exit={{ opacity: 0, transition: fades.out }}
                  initial={{ opacity: 0 }}
                  key="pocket"
                  layout="position"
                >
                  <PocketPlayer
                    finish={finish}
                    music={music}
                    onFinishChange={setFinish}
                    onMinimize={() => setSize("mini")}
                    onVideoChange={setVideoOpen}
                    progress={progress}
                    videoOn={videoOpen}
                  />
                  <div className="absolute -top-2.5 -right-2.5 z-30 flex gap-1 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                    <button
                      aria-label="Minimize the music player"
                      className={cx(
                        "glass grid size-7 cursor-pointer place-items-center rounded-full text-paper/80 transition-colors hover:text-paper disabled:opacity-40",
                        focusRing,
                      )}
                      disabled={needsVideo}
                      onClick={() => {
                        cue("press");
                        setSize("mini");
                      }}
                      title="Minimize"
                      type="button"
                    >
                      <MinimizeIcon size={14} />
                    </button>
                    <button
                      aria-label="Close the music player"
                      className={cx(
                        "glass grid size-7 cursor-pointer place-items-center rounded-full text-paper/80 transition-colors hover:text-paper",
                        focusRing,
                      )}
                      onClick={() => {
                        cue("press");
                        music.stop();
                      }}
                      title="Close"
                      type="button"
                    >
                      <CloseIcon size={14} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* The player: one element for the widget's whole life, so switching
            sizes never interrupts the music. It lies over the display. Clipping
            with clip-path keeps the frame's corners clean, which border-radius
            alone does not always do for an iframe. */}
            <div
              className={cx(
                "absolute bg-black transition-opacity duration-300 [clip-path:inset(0_round_3px)]",
                showVideo
                  ? "z-20 opacity-100"
                  : "pointer-events-none -z-20 opacity-0",
              )}
              inert={!showVideo}
              style={videoFrame}
            >
              {music.status === "loading" ? (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="animate-breathe text-paper">
                    <MusicNoteIcon size={24} />
                  </span>
                </div>
              ) : null}
              <div className="absolute inset-0" ref={music.hostRef} />
            </div>
            {mini ? null : (
              // Glare across the whole glass, over the display and the video.
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-30 rounded-[9px] bg-[linear-gradient(118deg,rgb(255_255_255/.2)_0%,rgb(255_255_255/.05)_34%,transparent_35%)]"
                style={glassFrame}
              />
            )}
          </motion.div>

          {!mini && music.status === "blocked" ? (
            <p className="glass mt-2 w-[248px] rounded-[16px] px-3.5 py-2.5 text-[11px] leading-snug text-paper/75">
              Your browser needs a tap on the video to start the sound.
            </p>
          ) : null}
          {!mini && music.status === "error" ? (
            <div className="glass mt-2 w-[248px] rounded-[18px] p-3.5 text-paper">
              <p className="text-[11px] leading-snug text-paper/70">
                YouTube wouldn’t play the playlist here. If it asks you to sign
                in, sign in on youtube.com in this browser, then try again.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={cx(
                    "label cursor-pointer rounded-full bg-paper px-3.5 py-2.5 text-ink transition-colors hover:bg-white",
                    focusRing,
                  )}
                  onClick={music.start}
                  type="button"
                >
                  Try again
                </button>
                <a
                  className={cx(
                    "label flex items-center gap-1.5 rounded-full border border-paper/15 px-3.5 py-2.5 text-paper/75 transition-colors hover:border-paper/40 hover:text-paper",
                    focusRing,
                  )}
                  href={trackUrl(track)}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open on YouTube
                  <ExternalIcon size={12} />
                </a>
              </div>
            </div>
          ) : null}
        </aside>
      )}
    </AnimatePresence>
  );
}
