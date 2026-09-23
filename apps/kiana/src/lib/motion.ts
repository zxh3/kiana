import type { Transition } from "motion/react";

/**
 * The app's motion vocabulary. Components pick a named feel instead of
 * inventing timings, so everything moves as one family.
 */
export const springs = {
  /** Small things that answer a tap: icons, highlights. Quick, no bounce. */
  snappy: { type: "spring", stiffness: 620, damping: 40, mass: 0.7 },
  /** Panels and cards opening, closing, or changing shape. */
  gentle: { type: "spring", stiffness: 340, damping: 34 },
  /** Larger surfaces such as the library, which should feel unhurried. */
  glide: { type: "spring", stiffness: 240, damping: 32 },
} as const satisfies Record<string, Transition>;

export const easeSoft = [0.22, 1, 0.36, 1] as const;

export const fades = {
  /** Getting out of the way. */
  out: { duration: 0.14, ease: easeSoft },
  /** Arriving. */
  in: { duration: 0.32, ease: easeSoft },
  /** Text that changes with the photo, in step with its crossfade. */
  caption: { duration: 0.7, ease: easeSoft },
} as const satisfies Record<string, Transition>;
