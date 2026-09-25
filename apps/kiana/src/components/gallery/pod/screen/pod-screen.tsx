import {
  AnimatePresence,
  motion,
  useIsPresent,
  type Variants,
} from "motion/react";
import type { PointerEvent, ReactNode } from "react";

import { cx } from "../../../../lib/class-names";
import { easeSoft, fades } from "../../../../lib/motion";
import { useClickSwallow } from "../../use-click-swallow";
import { DISPLAY_INSET, glassFrame } from "../device/geometry";
import { type Screen, screens } from "../menu";
import type { BatteryState } from "../use-battery";
import { LockGlyph, type PlayState } from "./glyphs";
import { StatusBar } from "./status-bar";

/** Deeper screens slide in from the right; Menu slides them back out. */
const slide: Variants = {
  enter: (direction: number) => ({ x: `${direction * 100}%` }),
  center: { x: 0 },
  exit: (direction: number) => ({ x: `${direction * -100}%` }),
};

/** A screen on its way out keeps drawing but takes no more taps or focus. */
function Pane({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  return (
    <div
      className={cx("absolute inset-0", !present && "pointer-events-none")}
      inert={!present}
    >
      {children}
    </div>
  );
}

/**
 * The glass window and the colour display set inside it, a touch screen
 * that answers taps as well as the click wheel. Inside: the status bar,
 * the current screen sliding in and out, the padlock that answers a touch
 * while the hold switch is on, and the backlight dimming when idle.
 *
 * Its rows and covers are for pointers; from the keyboard the wheel's
 * buttons drive it, and a live region reads out what the wheel lands on.
 * A touch on a dimmed display only wakes it, as on a real device, so a tap
 * meant to light it never also jumps the song.
 */
export function PodScreen({
  asleep,
  battery,
  children,
  covered,
  description,
  direction,
  held,
  lit,
  lockShown,
  onBack,
  onWake,
  screen,
  state,
}: {
  /** Put to sleep by holding play: the screen is dark until touched. */
  asleep: boolean;
  battery: BatteryState | null;
  children: ReactNode;
  /** The video lies over the display, so it takes no focus or taps. */
  covered: boolean;
  /** What the display shows, in words, read out as it changes. */
  description: string;
  direction: 1 | -1;
  held: boolean;
  lit: boolean;
  lockShown: boolean;
  /** Set when there is somewhere to go back to. */
  onBack?: () => void;
  onWake: () => void;
  screen: Screen;
  state: PlayState;
}) {
  const swallow = useClickSwallow();

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swallow.disarm();
    if (lit) return;
    event.stopPropagation();
    swallow.arm();
    onWake();
  };

  return (
    <div
      className="rounded-[9px] bg-[#0a0a0b] shadow-[0_0_0_1px_rgb(0_0_0/.28),inset_0_0_0_1px_rgb(255_255_255/.05)]"
      style={{
        padding: DISPLAY_INSET,
        width: glassFrame.width,
        height: glassFrame.height,
      }}
    >
      <div
        className="relative flex h-full flex-col overflow-hidden rounded-[2px] bg-white font-pod select-none"
        inert={covered}
        onClickCapture={swallow.onClickCapture}
        onPointerDownCapture={handlePointerDown}
      >
        <p aria-live="polite" className="sr-only">
          {description}
        </p>
        <StatusBar
          battery={battery}
          held={held}
          onBack={onBack}
          state={state}
          title={screens[screen].title}
        />
        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence custom={direction} initial={false}>
            <motion.div
              animate="center"
              className="absolute inset-0 bg-white"
              custom={direction}
              exit="exit"
              initial="enter"
              key={screen}
              transition={{ duration: 0.26, ease: easeSoft }}
              variants={slide}
            >
              <Pane>{children}</Pane>
            </motion.div>
          </AnimatePresence>
          <AnimatePresence>
            {lockShown ? (
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 m-auto grid size-[58px] place-items-center rounded-[8px] border border-[#a5a5a5] bg-[linear-gradient(180deg,#fdfdfd,#e2e2e2)] shadow-[0_2px_8px_rgb(0_0_0/.25)]"
                exit={{ opacity: 0, transition: fades.out }}
                initial={{ opacity: 0, scale: 0.9 }}
                key="lock"
                transition={fades.in}
              >
                <LockGlyph size={30} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        {/* The backlight: bright while in use, dim when left alone, and
        dark while the player sleeps. */}
        <div
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-0 bg-black transition-opacity ease-out",
            asleep
              ? "opacity-100 duration-500"
              : lit
                ? "opacity-0 duration-150"
                : "opacity-40 duration-[1200ms]",
          )}
        />
      </div>
    </div>
  );
}
