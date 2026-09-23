import { type MouseEvent, type PointerEvent, useRef } from "react";

/** Movement before a press counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD = 6;

/**
 * A finger or pointer dragged across the screen, turned into steps like the
 * wheel's: one for every `size` pixels, forward when moving left (or up).
 * A swipe never also counts as a tap on what it started on.
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
  const swipe = useRef<{
    id: number;
    start: number;
    taken: number;
    swiping: boolean;
  } | null>(null);
  const swallowClick = useRef(false);
  const at = (event: PointerEvent) =>
    axis === "x" ? event.clientX : event.clientY;

  const end = () => {
    const current = swipe.current;
    swipe.current = null;
    if (!current?.swiping) return;
    swallowClick.current = true;
    window.setTimeout(() => {
      swallowClick.current = false;
    }, 0);
  };

  return {
    onClickCapture: (event: MouseEvent<T>) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onPointerCancel: end,
    onPointerDown: (event: PointerEvent<T>) => {
      if (event.button !== 0) return;
      swipe.current = {
        id: event.pointerId,
        start: at(event),
        taken: 0,
        swiping: false,
      };
    },
    onPointerMove: (event: PointerEvent<T>) => {
      const current = swipe.current;
      if (!current || current.id !== event.pointerId) return;
      const travel = current.start - at(event);
      if (!current.swiping) {
        if (Math.abs(travel) < SWIPE_THRESHOLD) return;
        current.swiping = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      const steps = Math.trunc(travel / size) - current.taken;
      if (steps === 0) return;
      current.taken += steps;
      latest.current(steps);
    },
    onPointerUp: end,
  };
}
