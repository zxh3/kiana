import { motion, type Variants } from "motion/react";
import { type CSSProperties, type ReactNode, useState } from "react";

import { cx } from "../../../lib/class-names";
import { easeSoft, springs } from "../../../lib/motion";
import { MusicNoteIcon } from "../icons";
import { useStoredState } from "../use-stored-state";
import {
  type Corner,
  PHONE_QUERY,
  parseCorner,
  parsePlayerSize,
} from "./music-layout";
import { MusicNotice } from "./music-notice";
import { DRAG_HANDLE } from "./pod/drag-handle";
import { type Finish, finishStyles } from "./pod/finishes";
import {
  BODY_PADDING,
  BODY_RADIUS,
  BODY_WIDTH,
  glassFrame,
  videoBelowTitleFrame,
  videoFrame,
} from "./pod/geometry";
import { NanoPlayer } from "./pod/nano-player";
import { PocketPlayer } from "./pod/pocket-player";
import { usePodSettings } from "./pod/settings";
import { usePod } from "./pod/use-pod";
import { useCornerDrag } from "./use-corner-drag";
import { useMediaQuery } from "./use-media-query";
import type { Music } from "./use-music";
import { useMusicProgress } from "./use-music-progress";

const SIZE_KEY = "kiana.music-size";
const CORNER_KEY = "kiana.music-corner";
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

/** Where each device grows from and shrinks into: the corner it lives in. */
const origins: Record<Corner, string> = {
  "top-left": "0% 0%",
  "top-right": "100% 0%",
  "bottom-left": "0% 100%",
  "bottom-right": "100% 100%",
};

/**
 * Showing and hiding a device, in transform and opacity only, which the
 * browser composites without laying anything out again. A device grows out
 * of its corner on a soft spring and shrinks back into it quickly; hidden,
 * it stops drawing altogether. `delay` lets one device wait for the other
 * to get out of the way.
 */
const reveal = (delay: number): Variants => ({
  shown: {
    opacity: 1,
    scale: 1,
    visibility: "visible",
    transition: {
      scale: { ...springs.gentle, delay },
      opacity: { duration: 0.2, ease: easeSoft, delay },
    },
  },
  hidden: {
    opacity: 0,
    scale: 0.4,
    transition: {
      scale: { duration: 0.24, ease: [0.4, 0, 0.6, 1] },
      opacity: { duration: 0.16, ease: "easeIn", delay: 0.06 },
    },
    transitionEnd: { visibility: "hidden" },
  },
});

const BODY_SHADOW =
  "inset 0 1px 0 var(--pod-rim), inset 0 -1px 1px rgb(0 0 0 / 0.18), 0 22px 56px -20px rgb(0 0 0 / 0.75)";

/** An aluminium body in the chosen finish, with its brushed grain. */
function Body({
  children,
  finish,
  lifted,
  radius,
  style,
}: {
  children: ReactNode;
  finish: Finish;
  lifted: boolean;
  radius: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx(
        "relative isolate transition-[scale] duration-300 ease-soft",
        lifted && "scale-[1.03]",
      )}
      style={{
        ...(finishStyles[finish] as CSSProperties),
        backgroundImage: "var(--pod-body)",
        borderRadius: radius,
        boxShadow: BODY_SHADOW,
        ...style,
      }}
    >
      {/* The deeper shadow of a lifted player, faded in rather than
      animating the blur, which would repaint it on every frame. */}
      <div
        aria-hidden="true"
        className={cx(
          "pointer-events-none absolute inset-0 -z-20 rounded-[inherit] shadow-[0_34px_80px_-24px_rgb(0_0_0/.85)] transition-opacity duration-300 ease-soft",
          lifted ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-45 [background-image:repeating-linear-gradient(90deg,rgb(255_255_255/.07)_0_1px,transparent_1px_3px)]"
      />
      {children}
    </div>
  );
}

/**
 * The now-playing widget, above the photos, menus, and library, made like
 * the pocket music players of the 2000s: an aluminium body, a colour screen
 * with menus, a click wheel, and a hold switch. Minimized, it becomes a
 * small square player showing the cover. The devices live in `pod/`; this
 * file places them on the page and keeps YouTube's player alive.
 *
 * The two sizes are two devices, both always mounted. Minimizing shrinks
 * the full player into its corner and grows the small one out of it, and
 * expanding does the reverse, so neither ever changes shape. On wider
 * screens the player can be dragged to any corner, where it stays; on
 * phones the full player rises from the bottom edge.
 *
 * YouTube's player lives inside the full device for the widget's whole
 * life, so playback never stops, hidden until needed. It covers the display
 * when YouTube needs a tap or a sign-in, or when the cover on Now Playing
 * is tapped. Hiding a playing embed goes against YouTube's API policies
 * (III.I.9); that trade-off was the site owner's choice.
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
  const fullShown = !idle && !mini;
  const nanoShown = !idle && mini;
  const docked = phone;
  // The small player drags from anywhere; the full one only by its handle,
  // so its screen and wheel are free for touch.
  const fullDrag = useCornerDrag<HTMLElement>({
    corner,
    handle: `[${DRAG_HANDLE}]`,
    onCornerChange: setCorner,
  });
  const nanoDrag = useCornerDrag<HTMLElement>({
    corner,
    onCornerChange: setCorner,
  });
  const showVideo = fullShown && (videoOpen || needsVideo);
  const progress = useMusicProgress(
    music.readProgress,
    idle ? null : mini ? 1_000 : 250,
  );
  // Owned here, above both sizes, so minimizing keeps the device's screen,
  // highlight, and hold switch where they were.
  const pod = usePod({
    music,
    onVideoChange: setVideoOpen,
    progress,
    settings,
    videoCovers: showVideo,
    videoOpen,
  });

  return (
    <>
      <aside
        aria-label="Music"
        className={cx(
          "group/player fixed z-50 transition-[bottom] duration-500 ease-soft",
          !fullShown && "pointer-events-none",
          docked
            ? "inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] mx-auto w-fit"
            : cx("select-none", cornerClasses[corner]),
        )}
        data-raised={raised || undefined}
        inert={!fullShown}
        ref={fullDrag.ref}
        {...(docked ? {} : fullDrag.handlers)}
      >
        <motion.div
          animate={fullShown ? "shown" : "hidden"}
          className="flex flex-col items-center"
          initial={false}
          style={{ transformOrigin: docked ? "50% 100%" : origins[corner] }}
          variants={reveal(0)}
        >
          <Body
            finish={settings.finish}
            lifted={fullDrag.dragging}
            radius={BODY_RADIUS}
            style={{ padding: BODY_PADDING, width: BODY_WIDTH }}
          >
            <PocketPlayer
              active={fullShown}
              canMinimize={!needsVideo}
              chromeVisible={chromeVisible}
              covered={showVideo}
              movable={!docked}
              music={music}
              onClose={music.stop}
              onMinimize={() => setSize("mini")}
              pod={pod}
              progress={progress}
            />

            {/* YouTube's player: one element for the widget's whole life,
            so switching sizes never interrupts the music. It lies over the
            display. clip-path keeps the frame's corners clean, which
            border-radius alone does not always do for an iframe. */}
            <div
              className={cx(
                "absolute bg-black transition-opacity duration-300",
                // Rounded to the display's corners; under the title bar
                // only the bottom ones.
                needsVideo
                  ? "[clip-path:inset(0_round_3px)]"
                  : "[clip-path:inset(0_round_0_0_3px_3px)]",
                showVideo
                  ? "z-20 opacity-100"
                  : "pointer-events-none -z-20 opacity-0",
              )}
              inert={!showVideo}
              style={needsVideo ? videoFrame : videoBelowTitleFrame}
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
            {/* Glare across the whole glass, over the display and the video. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-30 rounded-[9px] bg-[linear-gradient(118deg,rgb(255_255_255/.2)_0%,rgb(255_255_255/.05)_34%,transparent_35%)]"
              style={glassFrame}
            />
          </Body>
          <MusicNotice music={music} width={BODY_WIDTH} />
        </motion.div>
      </aside>

      <aside
        aria-label="Music, minimized"
        className={cx(
          "fixed z-50 touch-none select-none transition-[bottom] duration-500 ease-soft",
          cornerClasses[corner],
          nanoShown
            ? nanoDrag.dragging
              ? "cursor-grabbing"
              : "cursor-grab"
            : "pointer-events-none",
        )}
        data-raised={raised || undefined}
        inert={!nanoShown}
        ref={nanoDrag.ref}
        title={nanoShown && !nanoDrag.dragging ? "Drag to move" : undefined}
        {...nanoDrag.handlers}
      >
        <motion.div
          animate={nanoShown ? "shown" : "hidden"}
          initial={false}
          style={{ transformOrigin: origins[corner] }}
          // The small player waits for the big one to start tucking away.
          variants={reveal(0.08)}
        >
          <Body
            finish={settings.finish}
            lifted={nanoDrag.dragging}
            radius={NANO_RADIUS}
          >
            <NanoPlayer
              music={music}
              onExpand={() => setSize("full")}
              progress={progress}
            />
          </Body>
        </motion.div>
      </aside>
    </>
  );
}
