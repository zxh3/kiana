import { useEffect, useRef } from "react";

const BARS = 30;
const GAP = 2;
const RETARGET_MS = 90;
const PEAK_HOLD_FRAMES = 16;
const PEAK_FALL = 0.011;

/**
 * A spectrum analyser in the spirit of the classic desktop players. The
 * music plays inside YouTube's frame, where its audio cannot be measured,
 * so the bars are a lively imitation: bass-heavy, fast to rise, slow to fall,
 * with peak caps that hang and drop. When playback stops, everything settles.
 */
export function Spectrum({
  active,
  className,
  playing,
}: {
  active: boolean;
  className?: string;
  playing: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({
    levels: new Float32Array(BARS),
    targets: new Float32Array(BARS),
    peaks: new Float32Array(BARS),
    holds: new Uint8Array(BARS),
    lastRetarget: 0,
  });
  const playingRef = useRef(playing);
  playingRef.current = playing;

  // Restarts when playback resumes: the loop stops once the bars settle.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `playing` restarts the loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let frame = 0;

    const draw = (now: number) => {
      const { levels, targets, peaks, holds } = state.current;
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.round(width * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const live = playingRef.current;
      if (live && now - state.current.lastRetarget > RETARGET_MS) {
        state.current.lastRetarget = now;
        const beat = 0.5 + 0.5 * Math.sin(now / 240);
        for (let index = 0; index < BARS; index += 1) {
          const position = index / (BARS - 1);
          const envelope = 0.92 - position * 0.5;
          const pulse = position < 0.25 ? beat * 0.25 : 0;
          targets[index] = Math.min(
            1,
            envelope * (0.3 + 0.6 * Math.random()) + pulse,
          );
        }
      } else if (!live) {
        targets.fill(0);
      }

      const barWidth = (width - GAP * (BARS - 1)) / BARS;
      const gradient = context.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, "rgba(244, 198, 124, 0.95)");
      gradient.addColorStop(0.7, "rgba(248, 168, 128, 0.9)");
      gradient.addColorStop(1, "rgba(255, 122, 138, 0.9)");

      let settled = !live;
      for (let index = 0; index < BARS; index += 1) {
        const rising = targets[index] > levels[index];
        levels[index] +=
          (targets[index] - levels[index]) * (rising ? 0.42 : 0.1);
        if (levels[index] >= peaks[index]) {
          peaks[index] = levels[index];
          holds[index] = PEAK_HOLD_FRAMES;
        } else if (holds[index] > 0) {
          holds[index] -= 1;
        } else {
          peaks[index] = Math.max(0, peaks[index] - PEAK_FALL);
        }
        if (levels[index] > 0.005 || peaks[index] > 0.005) settled = false;

        const x = index * (barWidth + GAP);
        const barHeight = Math.max(1.5, levels[index] * (height - 4));
        context.fillStyle = gradient;
        context.globalAlpha = 0.25 + 0.75 * Math.min(1, levels[index] * 1.6);
        context.fillRect(x, height - barHeight, barWidth, barHeight);
        context.globalAlpha = 0.9;
        context.fillStyle = "rgba(246, 240, 230, 0.9)";
        const peakY = height - 2 - peaks[index] * (height - 4);
        context.fillRect(x, Math.min(height - 2, peakY), barWidth, 1.5);
      }
      context.globalAlpha = 1;

      if (reduceMotion || settled) return;
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, playing]);

  return (
    <div aria-hidden="true" className={className}>
      <canvas className="block size-full" ref={canvasRef} />
    </div>
  );
}
