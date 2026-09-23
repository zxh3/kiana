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
  /**
   * Next and previous photo: the detent of a rotary knob. Arrow keys repeat,
   * so it is rate-limited, which also paces the clicks like a turned dial.
   */
  next: { recipe: "detentForward", every: 45 },
  previous: { recipe: "detentBack", every: 45 },
  /** A photo picked in the library: the same detent, a dial set to it. */
  pickPhoto: { recipe: "detentForward" },
  /** Next and previous song in the music player: a lighter tick. */
  songNext: { recipe: "tickForward", every: 45 },
  songPrevious: { recipe: "tickBack", every: 45 },
  /** A menu, dialog, or the full music player opening. */
  open: { recipe: "pop" },
  /** An option chosen in a menu, a filter, or a list. */
  select: { recipe: "pluck" },
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
