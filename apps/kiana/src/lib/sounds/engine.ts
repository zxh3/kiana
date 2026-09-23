import { type CueName, cues } from "./cues";
import { createGate } from "./gate";
import { recipes } from "./recipes";

/** Kept low: these sounds accompany the photos and music, never lead. */
const MASTER_VOLUME = 0.5;
const MAX_VOICES = 8;
const MIN_GAP_MS = 30;

type AudioWindow = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

let context: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;
/** The viewer's level for interface sounds, from 0 to 1. */
let volume = 1;
const gate = createGate({ maxVoices: MAX_VOICES, minGap: MIN_GAP_MS });

export function soundsSupported() {
  if (typeof window === "undefined") return false;
  const audioWindow = window as AudioWindow;
  return Boolean(audioWindow.AudioContext ?? audioWindow.webkitAudioContext);
}

export function setSoundsEnabled(value: boolean) {
  enabled = value;
}

/** Sets how loud interface sounds are, from 0 to 1. */
export function setSoundsVolume(value: number) {
  volume = Math.max(0, Math.min(1, value));
  if (master) master.gain.value = MASTER_VOLUME * volume;
}

/**
 * The context is created on the first cue, which always runs inside a click
 * or key press, so browsers let it start. A gentle compressor keeps
 * overlapping sounds from ever getting harsh.
 */
function ensureContext() {
  if (!soundsSupported()) return null;
  if (!context || context.state === "closed") {
    const audioWindow = window as AudioWindow;
    const Context = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!Context) return null;
    const created = new Context({ latencyHint: "interactive" });
    const compressor = created.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;
    const level = created.createGain();
    level.gain.value = MASTER_VOLUME * volume;
    level.connect(compressor).connect(created.destination);
    context = created;
    master = level;
  }
  // Resumes after the browser suspended it, such as on iOS after a call.
  if (context.state !== "running") void context.resume().catch(() => undefined);
  return context;
}

/** Plays the sound for an action, when interface sounds are on. */
export function playCue(name: CueName) {
  if (!enabled || volume === 0) return;
  const audio = ensureContext();
  if (!audio || !master) return;
  const cue: { recipe: keyof typeof recipes; every?: number } = cues[name];
  const now = audio.currentTime;
  if (!gate.admit(name, now, cue.every)) return;
  try {
    gate.track(recipes[cue.recipe](audio, master, now + 0.005));
  } catch {
    // Sound is a nicety; a failure must never break the interface.
  }
}
