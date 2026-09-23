/**
 * Building blocks for interface sounds: a pitched tone and a filtered noise
 * burst, each with a short envelope. Every block schedules its own nodes,
 * cleans them up when they stop, and returns the time it ends.
 */

const SILENT = 0.0001;

export type ToneOptions = {
  /** Start time, in seconds on the context's clock. */
  at: number;
  /** Starting pitch in hertz, and where it glides to, if anywhere. */
  from: number;
  to?: number;
  /** How long the glide takes; defaults to the decay. */
  glide?: number;
  type?: OscillatorType;
  attack?: number;
  decay: number;
  gain: number;
};

export function tone(
  context: BaseAudioContext,
  output: AudioNode,
  {
    at,
    from,
    to,
    glide,
    type = "sine",
    attack = 0.002,
    decay,
    gain,
  }: ToneOptions,
) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, at);
  if (to !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(
      to,
      at + (glide ?? decay),
    );
  }
  envelope.gain.setValueAtTime(SILENT, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + attack);
  envelope.gain.exponentialRampToValueAtTime(SILENT, at + attack + decay);
  oscillator.connect(envelope).connect(output);

  const end = at + attack + decay + 0.02;
  oscillator.start(at);
  oscillator.stop(end);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
  return end;
}

export type NoiseOptions = {
  at: number;
  duration: number;
  filter: BiquadFilterType;
  /** Filter frequency in hertz, and where it sweeps to, if anywhere. */
  from: number;
  to?: number;
  q?: number;
  attack?: number;
  gain: number;
};

export function noise(
  context: BaseAudioContext,
  output: AudioNode,
  { at, duration, filter, from, to, q = 1, attack = 0.004, gain }: NoiseOptions,
) {
  const source = context.createBufferSource();
  const shape = context.createBiquadFilter();
  const envelope = context.createGain();
  source.buffer = noiseBuffer(context);
  shape.type = filter;
  shape.Q.value = q;
  shape.frequency.setValueAtTime(from, at);
  if (to !== undefined) {
    shape.frequency.exponentialRampToValueAtTime(to, at + duration);
  }
  envelope.gain.setValueAtTime(SILENT, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + attack);
  envelope.gain.exponentialRampToValueAtTime(SILENT, at + duration);
  source.connect(shape).connect(envelope).connect(output);

  const end = at + duration + 0.02;
  source.start(at, Math.random() * 0.5);
  source.stop(end);
  source.onended = () => {
    source.disconnect();
    shape.disconnect();
    envelope.disconnect();
  };
  return end;
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** One second of white noise per context, made once and reused. */
function noiseBuffer(context: BaseAudioContext) {
  let buffer = noiseBuffers.get(context);
  if (!buffer) {
    buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    noiseBuffers.set(context, buffer);
  }
  return buffer;
}
