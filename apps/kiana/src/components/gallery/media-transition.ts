import type { CSSProperties } from "react";

import { cx } from "../../lib/class-names";
import { TRANSITION_DURATION, type Transition } from "./model";

export type LayerDirection = "enter" | "exit" | "hidden";

const layerClass =
  "absolute inset-0 z-1 overflow-hidden backface-hidden transition-[opacity,transform,filter] ease-[cubic-bezier(.4,0,.2,1)] will-change-[transform,opacity] motion-reduce:transition-none";

const transitionClasses: Record<Transition, Record<LayerDirection, string>> = {
  fade: {
    enter: "z-2 opacity-100 starting:opacity-0",
    exit: "opacity-0 starting:opacity-100",
    hidden: "pointer-events-none opacity-0",
  },
  float: {
    enter:
      "z-2 translate-y-0 scale-100 opacity-100 starting:translate-y-[2%] starting:scale-[1.02] starting:opacity-0",
    exit: "-translate-y-[1%] scale-[1.01] opacity-0 starting:translate-y-0 starting:scale-100 starting:opacity-100",
    hidden: "pointer-events-none opacity-0",
  },
  settle: {
    enter: "z-2 opacity-100 starting:opacity-0",
    exit: "opacity-0 starting:opacity-100",
    hidden: "pointer-events-none opacity-0",
  },
};

const transitionTimings: Record<
  Transition,
  Record<LayerDirection, { duration: number; start: number }>
> = {
  fade: {
    enter: { duration: TRANSITION_DURATION, start: 0 },
    exit: { duration: TRANSITION_DURATION, start: 0 },
    hidden: { duration: 0, start: 0 },
  },
  float: {
    enter: { duration: TRANSITION_DURATION, start: 0 },
    exit: { duration: TRANSITION_DURATION, start: 0 },
    hidden: { duration: 0, start: 0 },
  },
  settle: {
    enter: { duration: 900, start: 550 },
    exit: { duration: 550, start: 0 },
    hidden: { duration: 0, start: 0 },
  },
};

export function mediaTransition(
  transition: Transition,
  direction: LayerDirection,
): { className: string; style: CSSProperties } {
  const timing = transitionTimings[transition][direction];
  return {
    className: cx(layerClass, transitionClasses[transition][direction]),
    style: {
      transitionDelay: `${timing.start}ms`,
      transitionDuration: `${timing.duration}ms`,
    },
  };
}
