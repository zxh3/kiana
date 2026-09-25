/**
 * The finger spinner's physics, kept free of React so it can be tested.
 * Speeds are in degrees per second, clockwise positive.
 *
 * Each click of the wheel flicks the spinner a little faster in the way it
 * turned, so a few quick turns wind it up and turning back brakes it. Let
 * go and it coasts, slowing the way a bearing does: a drag that grows with
 * speed and a little friction that brings it to a stop.
 */

/** Speed added by one click of the wheel: 20 rpm, so a whole turn adds 480. */
export const SPIN_KICK = 120;
/** Speed added by a flick (the centre button, or a tap on the spinner). */
export const SPIN_FLICK = 720;
/** The fastest it will go: 2,400 rpm. */
export const SPIN_MAX = 14_400;
/** The drag that grows with speed, per second. */
const DRAG = 0.08;
/** The friction that slows it evenly, in degrees per second per second. */
const FRICTION = 40;
/**
 * The fastest it is drawn turning. Faster than this, frames would skip so
 * far between lobes that it would seem to slow or turn backwards; beyond
 * it the blur grows instead, as a real one smears into a disc.
 */
const DRAWN_MAX = 1_500;
/** How far behind the lobes the blur trails at full speed, in degrees. */
export const BLUR_MAX = 110;

/** The speed after `steps` clicks of the wheel. */
export function kick(speed: number, steps: number) {
  return Math.max(-SPIN_MAX, Math.min(SPIN_MAX, speed + steps * SPIN_KICK));
}

/** The speed after a flick, in the way it already turns (clockwise at rest). */
export function flick(speed: number) {
  return kick(speed, (speed < 0 ? -SPIN_FLICK : SPIN_FLICK) / SPIN_KICK);
}

/** The speed after coasting for `seconds`; it stops rather than reverses. */
export function coast(speed: number, seconds: number) {
  const slowed =
    Math.abs(speed) * Math.exp(-DRAG * seconds) - FRICTION * seconds;
  return slowed > 0 ? Math.sign(speed) * slowed : 0;
}

export function rpm(speed: number) {
  return Math.round(Math.abs(speed) / 6);
}

/** How fast to draw it turning: the real speed, eased under a ceiling. */
export function drawnSpeed(speed: number) {
  return Math.sign(speed) * DRAWN_MAX * Math.tanh(Math.abs(speed) / DRAWN_MAX);
}

/** How far the motion blur trails, in degrees. */
export function blurSpread(speed: number) {
  return (Math.min(Math.abs(speed), SPIN_MAX) / SPIN_MAX) * BLUR_MAX;
}

/** The best speed kept between visits, in rpm; anything odd is none yet. */
export function parseBestRpm(raw: string | null) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

/** The spinners to choose from in Settings, drawn in `art/`. */
export const spinnerStyles = ["stealth", "claw", "machined"] as const;
export type SpinnerStyle = (typeof spinnerStyles)[number];

export const spinnerStyleLabels: Record<SpinnerStyle, string> = {
  stealth: "Stealth",
  claw: "Claw",
  machined: "Machined",
};

export function parseSpinnerStyle(raw: string | null): SpinnerStyle {
  return spinnerStyles.includes(raw as SpinnerStyle)
    ? (raw as SpinnerStyle)
    : "stealth";
}

export function nextSpinnerStyle(style: SpinnerStyle): SpinnerStyle {
  return spinnerStyles[
    (spinnerStyles.indexOf(style) + 1) % spinnerStyles.length
  ];
}

/** Kiana's faces for the spinner's cap, to choose from in Settings. */
export const kianaFaces = ["curious", "calm", "shades"] as const;
export type KianaFace = (typeof kianaFaces)[number];

/** How the finger spinner looks: which spinner, and which Kiana on its cap. */
export type SpinnerLooks = { spinner: SpinnerStyle; face: KianaFace };

export const kianaFaceLabels: Record<KianaFace, string> = {
  curious: "Curious",
  calm: "Calm",
  shades: "Shades",
};

export function parseKianaFace(raw: string | null): KianaFace {
  return kianaFaces.includes(raw as KianaFace) ? (raw as KianaFace) : "curious";
}

export function nextKianaFace(face: KianaFace): KianaFace {
  return kianaFaces[(kianaFaces.indexOf(face) + 1) % kianaFaces.length];
}
