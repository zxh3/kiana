import type { RecipeName } from "./recipes";

type Cue = {
  recipe: RecipeName;
  /** The shortest gap between repeats, in milliseconds. */
  every?: number;
};

/**
 * What each action in the interface sounds like. Call sites name the action,
 * never the sound, so the palette can change in one place.
 *
 * The palette is deliberately small, one sound per kind of meaning:
 * - notch: touching any control
 * - detent: moving from one item to the next
 * - chime: keeping something
 * - sweep: the library coming and going
 * - thud: something that did not work
 */
export const cues = {
  // Controls: buttons, menus, options, switches.
  press: { recipe: "notch" },
  open: { recipe: "notch" },
  select: { recipe: "notch" },
  switchOn: { recipe: "notch" },
  switchOff: { recipe: "notch" },
  unfavorite: { recipe: "notch" },

  // Moving through photos and songs, like turning a knob. Arrow keys repeat,
  // so these are rate-limited, which also paces the clicks like a dial.
  next: { recipe: "detentForward", every: 45 },
  previous: { recipe: "detentBack", every: 45 },
  pickPhoto: { recipe: "detentForward" },
  songNext: { recipe: "detentForward", every: 45 },
  songPrevious: { recipe: "detentBack", every: 45 },
  // The music player's click wheel: a fine tick for every click of travel.
  wheel: { recipe: "notch", every: 30 },

  // Keeping something.
  favorite: { recipe: "chime" },
  copied: { recipe: "chime" },

  // The library.
  libraryOpen: { recipe: "sweepUp" },
  libraryClose: { recipe: "sweepDown" },

  error: { recipe: "thud" },
} satisfies Record<string, Cue>;

export type CueName = keyof typeof cues;
