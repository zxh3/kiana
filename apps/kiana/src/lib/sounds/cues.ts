import type { RecipeName } from "./recipes";

type Cue = {
  recipe: RecipeName;
  /** The shortest gap between repeats, in milliseconds. */
  every?: number;
};

/**
 * What each action in the interface sounds like. Call sites name the action,
 * never the sound, so the palette can change in one place.
 */
export const cues = {
  /** Play or pause, full screen, and other plain buttons. */
  press: { recipe: "press" },
  /** Next photo or song. Arrow keys repeat, so it is rate-limited. */
  next: { recipe: "tickForward", every: 45 },
  /** Previous photo or song. */
  previous: { recipe: "tickBack", every: 45 },
  /** A menu, dialog, or the full music player opening. */
  open: { recipe: "pop" },
  /** An option chosen in a menu, a filter, or a list. */
  select: { recipe: "tock" },
  libraryOpen: { recipe: "sweepUp" },
  libraryClose: { recipe: "sweepDown" },
  favorite: { recipe: "chime" },
  unfavorite: { recipe: "unchime" },
  copied: { recipe: "glint" },
  switchOn: { recipe: "switchOn" },
  switchOff: { recipe: "switchOff" },
  error: { recipe: "thud" },
} satisfies Record<string, Cue>;

export type CueName = keyof typeof cues;
