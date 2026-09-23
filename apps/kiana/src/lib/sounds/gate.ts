/**
 * Decides whether a cue may play now: not too soon after the same cue, and
 * not when too many sounds are already ringing. Times are in seconds.
 */
export function createGate({
  maxVoices,
  minGap,
}: {
  maxVoices: number;
  /** Default shortest gap between repeats of one cue, in milliseconds. */
  minGap: number;
}) {
  const lastPlayed = new Map<string, number>();
  let voiceEnds: number[] = [];

  return {
    admit(name: string, now: number, gap = minGap) {
      voiceEnds = voiceEnds.filter((end) => end > now);
      if (voiceEnds.length >= maxVoices) return false;
      const last = lastPlayed.get(name);
      if (last !== undefined && (now - last) * 1000 < gap) return false;
      lastPlayed.set(name, now);
      return true;
    },
    /** Record a sound that rings until `end`. */
    track(end: number) {
      voiceEnds.push(end);
    },
  };
}
