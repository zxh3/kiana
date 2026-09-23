import { noise, tone } from "./synth";

/**
 * Each recipe schedules one sound starting at `at` and returns when it ends.
 * They are original and deliberately quiet: short, soft-edged, and pitched
 * to sit under background music rather than over it.
 */
export type Recipe = (
  context: BaseAudioContext,
  output: AudioNode,
  at: number,
) => number;

/** A soft bell: a sine with a faint inharmonic overtone. */
function bell(
  context: BaseAudioContext,
  output: AudioNode,
  at: number,
  pitch: number,
  gain: number,
  decay: number,
) {
  return Math.max(
    tone(context, output, { at, from: pitch, decay, gain }),
    tone(context, output, {
      at,
      from: pitch * 2.76,
      decay: decay * 0.35,
      gain: gain * 0.22,
    }),
  );
}

/**
 * One detent of a rotary knob, like an old car stereo's volume dial: the
 * ball bearing lifts out of one notch with a faint tick, then snaps into
 * the next. The snap is all texture and no tone: a hard edge of air, two
 * brief inharmonic metal resonances, and a dry, low scrape of the housing.
 * Each click varies slightly, as a real mechanism does.
 */
function detent(
  context: BaseAudioContext,
  output: AudioNode,
  at: number,
  ring: number,
) {
  const vary = 1 + (Math.random() - 0.5) * 0.08;
  const snap = at + 0.007 + Math.random() * 0.002;
  return Math.max(
    // Lifting out of the notch.
    noise(context, output, {
      at,
      duration: 0.003,
      filter: "highpass",
      from: 4200,
      attack: 0.0004,
      gain: 0.07,
    }),
    // The snap's edge.
    noise(context, output, {
      at: snap,
      duration: 0.004,
      filter: "highpass",
      from: 2600,
      attack: 0.0003,
      gain: 0.26,
    }),
    // The detent spring and plate ringing, briefly and not in tune.
    noise(context, output, {
      at: snap,
      duration: 0.018,
      filter: "bandpass",
      from: ring * vary,
      q: 7,
      attack: 0.0004,
      gain: 0.3,
    }),
    noise(context, output, {
      at: snap,
      duration: 0.012,
      filter: "bandpass",
      from: ring * 1.53 * vary,
      q: 7,
      attack: 0.0004,
      gain: 0.18,
    }),
    // The housing: a dry, low scrape instead of a tone.
    noise(context, output, {
      at: snap,
      duration: 0.01,
      filter: "bandpass",
      from: 700 * vary,
      q: 1.4,
      attack: 0.0005,
      gain: 0.12,
    }),
  );
}

export const recipes = {
  /** A knob turned clockwise: the detent rings a little higher. */
  detentForward: (context, output, at) => detent(context, output, at, 3100),

  /** A knob turned back: the same detent, a little lower. */
  detentBack: (context, output, at) => detent(context, output, at, 2700),

  /** A rounded click with a tiny breath of air, for primary buttons. */
  press: (context, output, at) =>
    Math.max(
      tone(context, output, {
        at,
        from: 1500,
        to: 700,
        glide: 0.02,
        decay: 0.045,
        gain: 0.26,
      }),
      noise(context, output, {
        at,
        duration: 0.012,
        filter: "highpass",
        from: 2600,
        gain: 0.1,
      }),
    ),

  /** A light tick that leans up, for moving forward. */
  tickForward: (context, output, at) =>
    tone(context, output, {
      at,
      type: "triangle",
      from: 2500,
      to: 1900,
      glide: 0.015,
      decay: 0.03,
      gain: 0.16,
    }),

  /** The same tick a little lower, for moving back. */
  tickBack: (context, output, at) =>
    tone(context, output, {
      at,
      type: "triangle",
      from: 2000,
      to: 1500,
      glide: 0.015,
      decay: 0.03,
      gain: 0.16,
    }),

  /** A small rising bubble, for a menu or panel opening. */
  pop: (context, output, at) =>
    tone(context, output, {
      at,
      from: 420,
      to: 860,
      glide: 0.07,
      attack: 0.004,
      decay: 0.09,
      gain: 0.2,
    }),

  /**
   * A soft, round pluck for choosing an option: a pure tone that settles
   * onto its pitch, with a faint octave shimmer and no noise.
   */
  pluck: (context, output, at) =>
    Math.max(
      tone(context, output, {
        at,
        from: 1108,
        to: 1046.5,
        glide: 0.02,
        attack: 0.003,
        decay: 0.12,
        gain: 0.17,
      }),
      tone(context, output, {
        at,
        from: 2093,
        attack: 0.002,
        decay: 0.04,
        gain: 0.035,
      }),
    ),

  /** Air sweeping upward, like a sheet of paper lifted, for the library. */
  sweepUp: (context, output, at) =>
    Math.max(
      noise(context, output, {
        at,
        duration: 0.26,
        filter: "bandpass",
        from: 350,
        to: 2600,
        q: 1.2,
        attack: 0.09,
        gain: 0.32,
      }),
      tone(context, output, {
        at,
        from: 180,
        to: 260,
        attack: 0.05,
        decay: 0.2,
        gain: 0.04,
      }),
    ),

  /** The same air settling back down, for closing the library. */
  sweepDown: (context, output, at) =>
    noise(context, output, {
      at,
      duration: 0.22,
      filter: "bandpass",
      from: 2400,
      to: 420,
      q: 1.2,
      attack: 0.03,
      gain: 0.28,
    }),

  /** Two soft bells rising a fifth, for keeping a photo. */
  chime: (context, output, at) =>
    Math.max(
      bell(context, output, at, 1318.5, 0.15, 0.5),
      bell(context, output, at + 0.075, 1975.5, 0.12, 0.55),
    ),

  /** One low bell, for letting a favorite go. */
  unchime: (context, output, at) => bell(context, output, at, 784, 0.1, 0.26),

  /** Three quick glints climbing, for a copied link. */
  glint: (context, output, at) =>
    Math.max(
      ...[2093, 2637, 3136].map((pitch, step) =>
        tone(context, output, {
          at: at + step * 0.045,
          from: pitch,
          decay: 0.08,
          gain: 0.08,
        }),
      ),
    ),

  /** A switch flicked on: a click that lifts. */
  switchOn: (context, output, at) =>
    Math.max(
      tone(context, output, {
        at,
        type: "triangle",
        from: 1300,
        to: 2000,
        glide: 0.02,
        decay: 0.04,
        gain: 0.15,
      }),
      noise(context, output, {
        at,
        duration: 0.01,
        filter: "highpass",
        from: 3000,
        gain: 0.06,
      }),
    ),

  /** A switch flicked off: the same click falling. */
  switchOff: (context, output, at) =>
    Math.max(
      tone(context, output, {
        at,
        type: "triangle",
        from: 1900,
        to: 1200,
        glide: 0.02,
        decay: 0.04,
        gain: 0.14,
      }),
      noise(context, output, {
        at,
        duration: 0.01,
        filter: "highpass",
        from: 3000,
        gain: 0.05,
      }),
    ),

  /** A soft low thud, for something that did not work. */
  thud: (context, output, at) =>
    tone(context, output, {
      at,
      from: 190,
      to: 95,
      glide: 0.12,
      attack: 0.003,
      decay: 0.14,
      gain: 0.3,
    }),
} satisfies Record<string, Recipe>;

export type RecipeName = keyof typeof recipes;
