/**
 * Interface sounds, generated in code with the Web Audio API: no audio files
 * and nothing to license.
 *
 * - synth.ts: building blocks (a tone, a filtered noise burst)
 * - recipes.ts: named sounds made from those blocks
 * - cues.ts: which sound each interface action makes
 * - gate.ts: rate limits and a cap on overlapping sounds
 * - engine.ts: the audio context, the master level, and the on/off switch
 *
 * Call `cue("next")` from an action handler, never from a timer, so a sound
 * only ever answers something the viewer did.
 */
export type { CueName } from "./cues";
export { playCue as cue, setSoundsEnabled, soundsSupported } from "./engine";
