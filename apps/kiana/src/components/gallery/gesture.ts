/**
 * What a touch on the photos meant, from where and when it started to
 * where and when it ended. Kept free of React so the rules can be tested
 * on their own.
 */

/** A sideways swipe at least this long moves to another photo. */
const SWIPE_DISTANCE = 48;
/** A touch that moves less than this, and ends quickly, is a tap. */
const TAP_SLOP = 10;
const TAP_TIME = 400;
/** A swipe must be this much more sideways than up or down. */
const SWIPE_SLANT = 1.4;

export type TouchPoint = { x: number; y: number; time: number };

/**
 * A swipe to the next photo (to the left) or the previous one, a tap, or
 * nothing: a scroll, a drag, or a slow press.
 */
export function classifyTouch(start: TouchPoint, end: TouchPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (
    Math.abs(dx) > SWIPE_DISTANCE &&
    Math.abs(dx) > Math.abs(dy) * SWIPE_SLANT
  ) {
    return dx < 0 ? "next" : "previous";
  }
  const still = Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP;
  return still && end.time - start.time < TAP_TIME ? "tap" : null;
}
