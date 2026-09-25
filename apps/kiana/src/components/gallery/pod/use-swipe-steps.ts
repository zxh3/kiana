import { type PointerEvent, useRef } from "react";

import { useClickSwallow } from "../use-click-swallow";
import { takeSteps } from "./device/wheel";

/** Movement before a press counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD = 6;

/**
 * A finger or pointer dragged across the screen, turned into steps like the
 * wheel's: one for every `size` pixels, forward when moving left (or up).
 * Travel is counted as it goes, as the wheel does, and a swipe answers the
 * moment it reverses. A swipe never also counts as a tap on what it
 * started on.
 */
export function useSwipeSteps<T extends HTMLElement>({
  axis,
  onStep,
  size,
}: {
  axis: "x" | "y";
  onStep: (steps: number) => void;
  size: number;
}) {
  const latest = useRef(onStep);
  latest.current = onStep;
  const swallow = useClickSwallow();
  const swipe = useRef<{
    id: number;
    last: number;
    travel: number;
    swiping: boolean;
  } | null>(null);
  const at = (event: PointerEvent) =>
    axis === "x" ? event.clientX : event.clientY;

  const end = () => {
    if (swipe.current?.swiping) swallow.arm();
    swipe.current = null;
  };

  return {
    onClickCapture: swallow.onClickCapture,
    onPointerCancel: end,
    onPointerDown: (event: PointerEvent<T>) => {
      swallow.disarm();
      if (event.button !== 0) return;
      swipe.current = {
        id: event.pointerId,
        last: at(event),
        travel: 0,
        swiping: false,
      };
    },
    onPointerMove: (event: PointerEvent<T>) => {
      const current = swipe.current;
      if (!current || current.id !== event.pointerId) return;
      const position = at(event);
      const delta = current.last - position;
      current.last = position;
      // Turning back drops what was left over the other way, so a swipe
      // that overshot the end of the list answers the moment it reverses.
      if (Math.sign(delta) === -Math.sign(current.travel)) current.travel = 0;
      current.travel += delta;
      if (!current.swiping) {
        if (Math.abs(current.travel) < SWIPE_THRESHOLD) return;
        current.swiping = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      const { steps, rest } = takeSteps(current.travel, size);
      current.travel = rest;
      if (steps !== 0) latest.current(steps);
    },
    onPointerUp: end,
  };
}
