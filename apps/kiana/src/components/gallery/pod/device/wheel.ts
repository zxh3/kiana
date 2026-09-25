/**
 * The arithmetic of the click wheel: turning, and which button lies
 * where. Kept free of React so the rules can be tested on their own.
 */

/** Wheel buttons that do something else when held, as on the original. */
export type HoldZone = "menu" | "previous" | "next" | "play";

/** Degrees of wheel travel per click: 24 clicks a turn, like the original. */
export const DEGREES_PER_STEP = 15;

/** The signed turn from one angle to another, in (-180, 180]. */
export function angleDelta(from: number, to: number) {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return delta;
}

/**
 * Which of the wheel's four buttons lies at an angle, in degrees clockwise
 * from the right (as `Math.atan2` gives it on screen): each owns a quarter
 * of the ring around its compass point.
 */
export function wheelZoneAt(angle: number): HoldZone {
  const a = angleDelta(0, angle);
  if (a > -135 && a <= -45) return "menu";
  if (a > -45 && a <= 45) return "next";
  if (a > 45 && a <= 135) return "play";
  return "previous";
}

/** Whole clicks in `travel`, and the travel left over toward the next one. */
export function takeSteps(travel: number, size: number) {
  const steps = Math.trunc(travel / size);
  return { steps, rest: travel - steps * size };
}
