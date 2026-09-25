import { type RefObject, useEffect, useRef } from "react";

import { takeSteps } from "./device/wheel";

/** Scroll distance that counts as one click of the wheel. */
const PIXELS_PER_STEP = 40;

/**
 * Scrolling over `ref` turns the wheel, so a mouse wheel or a trackpad
 * works like a thumb.
 */
export function useScrollSteps(
  ref: RefObject<HTMLElement | null>,
  onStep: (steps: number) => void,
) {
  const latest = useRef(onStep);
  latest.current = onStep;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let travel = 0;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      // Whichever way the scroll mostly goes: down or right is forward,
      // so a sideways trackpad swipe flips Cover Flow too.
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      travel += event.deltaMode === 1 ? delta * 16 : delta;
      const { steps, rest } = takeSteps(travel, PIXELS_PER_STEP);
      travel = rest;
      if (steps !== 0) latest.current(steps);
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [ref]);
}
