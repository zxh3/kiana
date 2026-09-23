import { AnimatePresence, motion } from "motion/react";
import { type CSSProperties, useState } from "react";

import { cx } from "../../../lib/class-names";
import { fades, springs } from "../../../lib/motion";
import { MusicNoteIcon } from "../icons";
import { useStoredState } from "../use-stored-state";
import { type Corner, parseCorner, parsePlayerSize } from "./music-layout";
import { MusicNotice } from "./music-notice";
import { DRAG_HANDLE } from "./pod/drag-handle";
import { finishStyles } from "./pod/finishes";
import {
  BODY_PADDING,
  BODY_RADIUS,
  BODY_WIDTH,
  glassFrame,
  videoFrame,
} from "./pod/geometry";
import { NanoPlayer } from "./pod/nano-player";
import { PocketPlayer } from "./pod/pocket-player";
import { usePodSettings } from "./pod/settings";
import { useCornerDrag } from "./use-corner-drag";
import { useMediaQuery } from "./use-media-query";
import type { Music } from "./use-music";
import { useMusicProgress } from "./use-music-progress";
import { WidgetActions } from "./widget-actions";

const SIZE_KEY = "kiana.music-size";
const CORNER_KEY = "kiana.music-corner";
const PHONE_QUERY = "(max-width: 639px)";
const NANO_RADIUS = 17;

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

const bodyShadow = (lifted: boolean) =>
  `inset 0 1px 0 var(--pod-rim), inset 0 -1px 1px rgb(0 0 0 / 0.18), ${
    lifted
      ? "0 34px 80px -24px rgb(0 0 0 / 0.85)"
      : "0 22px 56px -20px rgb(0 0 0 / 0.75)"
  }`;

const faceMotion = {
  animate: { opacity: 1, transition: { ...fades.in, delay: 0.08 } },
  exit: { opacity: 0, transition: fades.out },
  initial: { opacity: 0 },
  layout: "position",
} as const;

/**
 * The now-playing widget, above the photos, menus, and library, made like
 * the pocket music players of the 2000s: an aluminium body, a colour screen
 * with menus, a click wheel, and a hold switch. Minimized, it becomes a
 * small square player showing the cover. The device itself lives in `pod/`;
 * this file places it on the page and keeps YouTube's player alive.
 *
 * On wider screens it can be dragged to any corner, where it stays; on
 * phones the full player rises from the bottom edge.
 *
 * YouTube's player stays mounted throughout, so playback never stops,
 * hidden until needed. It covers the display when YouTube needs a tap or a
 * sign-in, or when the video is turned on in Settings. Hiding a playing
 * embed goes against YouTube's API policies (III.I.9); that trade-off was
 * the site owner's choice.
 */
export function MusicPlayer({
  chromeVisible,
  music,
  raised,
}: {
  /** Whether the gallery's controls are showing; the widget's follow them. */
  chromeVisible: boolean;
  music: Music;
  raised: boolean;
}) {
  const [videoOpen, setVideoOpen] = useState(false);
  const [size, setSize] = useStoredState(SIZE_KEY, parsePlayerSize);
  const [corner, setCorner] = useStoredState(CORNER_KEY, parseCorner);
  const settings = usePodSettings();
  const phone = useMediaQuery(PHONE_QUERY);
  const idle = music.status === "idle";
  const needsVideo = music.status === "blocked" || music.status === "error";
  const mini = size === "mini" && !needsVideo;
  const docked = phone && !mini;
  // The small player drags from anywhere; the full one only by its handle,
  // so its screen and wheel are free for touch.
  const drag = useCornerDrag<HTMLElement>({
    corner,
    handle: mini ? undefined : `[${DRAG_HANDLE}]`,
    onCornerChange: setCorner,
  });
  const showVideo = !mini && (videoOpen || needsVideo);
  const progress = useMusicProgress(
    music.readProgress,
    idle ? null : mini ? 1_000 : 250,
  );

  return (
    <AnimatePresence>
      {idle ? null : (
        <aside
          aria-label="Music"
          key="music"
          className={cx(
            "group/player fixed z-50 transition-[bottom] duration-500 ease-soft",
            docked
              ? "inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] mx-auto flex w-fit flex-col items-center"
              : cx(
                  "select-none",
                  cornerClasses[corner],
                  mini && "touch-none",
                  mini && (drag.dragging ? "cursor-grabbing" : "cursor-grab"),
                ),
          )}
          data-raised={raised || undefined}
          ref={drag.ref}
          title={mini && !drag.dragging ? "Drag to move" : undefined}
          {...(docked ? {} : drag.handlers)}
        >
          {/* The body, in the chosen finish. */}
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={cx(
              "relative isolate transition-[scale] duration-300 ease-soft",
              drag.dragging && "scale-[1.03]",
            )}
            exit={{ opacity: 0, y: 10, scale: 0.96, transition: fades.out }}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            layout
            style={{
              ...(finishStyles[settings.finish] as CSSProperties),
              backgroundImage: "var(--pod-body)",
              borderRadius: mini ? NANO_RADIUS : BODY_RADIUS,
              boxShadow: bodyShadow(drag.dragging),
              padding: mini ? 0 : BODY_PADDING,
              width: mini ? undefined : BODY_WIDTH,
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
                <motion.div key="nano" {...faceMotion}>
                  <NanoPlayer
                    music={music}
                    onExpand={() => setSize("full")}
                    progress={progress}
                  />
                </motion.div>
              ) : (
                <motion.div key="pocket" {...faceMotion}>
                  <PocketPlayer
                    movable={!docked}
                    music={music}
                    onVideoChange={setVideoOpen}
                    progress={progress}
                    settings={settings}
                    videoOn={videoOpen}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* YouTube's player: one element for the widget's whole life, so
            switching sizes never interrupts the music. It lies over the
            display. clip-path keeps the frame's corners clean, which
            border-radius alone does not always do for an iframe. */}
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

          {mini ? null : (
            <>
              <WidgetActions
                canMinimize={!needsVideo}
                onClose={music.stop}
                onMinimize={() => setSize("mini")}
                visible={chromeVisible}
              />
              <MusicNotice music={music} width={BODY_WIDTH} />
            </>
          )}
        </aside>
      )}
    </AnimatePresence>
  );
}
