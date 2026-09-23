import { AnimatePresence, motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

import { cx } from "../../../../../lib/class-names";
import { easeSoft, fades } from "../../../../../lib/motion";
import { DISPLAY_INSET, glassFrame } from "../geometry";
import { type Screen, screenTitles } from "../menu";
import type { BatteryState } from "../use-battery";
import { LockGlyph, type PlayState } from "./glyphs";
import { StatusBar } from "./status-bar";

/** Deeper screens slide in from the right; Menu slides them back out. */
const slide: Variants = {
  enter: (direction: number) => ({ x: `${direction * 100}%` }),
  center: { x: 0 },
  exit: (direction: number) => ({ x: `${direction * -100}%` }),
};

/**
 * The glass window and the colour display set inside it: the status bar,
 * the current screen sliding in and out, the padlock that answers a touch
 * while the hold switch is on, and the backlight dimming when idle.
 */
export function PodScreen({
  battery,
  children,
  direction,
  held,
  lit,
  lockShown,
  screen,
  state,
}: {
  battery: BatteryState | null;
  children: ReactNode;
  direction: 1 | -1;
  held: boolean;
  lit: boolean;
  lockShown: boolean;
  screen: Screen;
  state: PlayState;
}) {
  return (
    <div
      className="rounded-[9px] bg-[#0a0a0b] shadow-[0_0_0_1px_rgb(0_0_0/.28),inset_0_0_0_1px_rgb(255_255_255/.05)]"
      style={{
        padding: DISPLAY_INSET,
        width: glassFrame.width,
        height: glassFrame.height,
      }}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[2px] bg-white font-pod">
        <StatusBar
          battery={battery}
          held={held}
          state={state}
          title={screenTitles[screen]}
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
              {children}
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
        {/* The backlight: bright while in use, dim when left alone. */}
        <div
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-0 bg-black transition-opacity ease-out",
            lit ? "opacity-0 duration-150" : "opacity-45 duration-[1200ms]",
          )}
        />
      </div>
    </div>
  );
}
