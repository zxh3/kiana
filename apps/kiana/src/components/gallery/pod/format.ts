/** "3:07", the way the player writes times. */
export function formatPodTime(seconds: number) {
  const total =
    Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** How far through the song, as a percentage for a progress bar. */
export function progressPercent(current: number, duration: number) {
  return duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
}
