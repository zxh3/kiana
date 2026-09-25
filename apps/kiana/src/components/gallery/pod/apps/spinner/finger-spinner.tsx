import { useEffect, useRef } from "react";

import { HapticTap } from "../../../haptic-tap";
import { useStoredState } from "../../../use-stored-state";
import { useCountChange } from "../../use-count-change";
import { useSwipeSteps } from "../../use-swipe-steps";
import {
  BLUR_MAX,
  blurSpread,
  coast,
  drawnSpeed,
  flick,
  kick,
  parseBestRpm,
  rpm,
  type SpinnerLooks,
} from "./spinner";
import { SpinnerCap, SpinnerDefs, useArtIds } from "./spinner-art";

/** Swipe distance that counts as one click of the wheel. */
const SWIPE_STEP = 10;
/** Copies trailing the arms for the motion blur, faintest last. */
const GHOST_OPACITIES = [0.42, 0.28, 0.18, 0.1];
/** How often the readout changes, so the digits stay readable. */
const READOUT_EVERY = 120;

/**
 * The finger spinner under Apps. Each click of the wheel flicks it a
 * little faster in the way it turned (and clicks, to be felt), the centre
 * button or a tap on it gives it a bigger flick, and a sideways swipe on
 * the screen winds it too. Let go and it coasts down on its own, silently,
 * since sounds only ever answer the viewer. The readout shows its speed and
 * the best it has reached, kept between visits.
 *
 * The motion lives in refs and is drawn straight to the SVG each frame, so
 * a spin never re-renders the player; the physics are in `spinner.ts`.
 */
export function FingerSpinner({
  flicks,
  looks,
  onFlick,
  onStep,
  steps,
}: {
  /** Flicks so far, counted up by the player. */
  flicks: number;
  /** Which spinner, and which of Kiana's faces on its cap. */
  looks: SpinnerLooks;
  onFlick: () => void;
  onStep: (steps: number) => void;
  /** Wheel clicks so far, signed, counted up by the player. */
  steps: number;
}) {
  const ids = useArtIds();
  const [storedBest, setStoredBest] = useStoredState(
    "kiana.spinner-best",
    parseBestRpm,
  );
  const speed = useRef(0);
  const angle = useRef(0);
  const best = useRef(storedBest);
  const frame = useRef<number>(undefined);
  const lastFrame = useRef<number | null>(null);
  const lastReadout = useRef(0);
  const body = useRef<SVGUseElement>(null);
  const ghosts = useRef<Array<SVGUseElement | null>>([]);
  const readout = useRef<HTMLSpanElement>(null);
  const bestReadout = useRef<HTMLSpanElement>(null);

  // Swipes run left for forward, like the lists; here right is clockwise.
  const swipe = useSwipeSteps<HTMLDivElement>({
    axis: "x",
    onStep: (swiped) => onStep(-swiped),
    size: SWIPE_STEP,
  });

  // Kept when it comes to rest or the app closes, not every frame.
  const keepBest = useRef<() => void>(() => undefined);
  keepBest.current = () => {
    if (best.current > storedBest) setStoredBest(best.current);
  };

  const draw = (now: number) => {
    const turning = speed.current;
    const spread = blurSpread(turning);
    if (body.current) {
      body.current.setAttribute("transform", `rotate(${angle.current} 50 50)`);
      // At speed the lobes themselves fade into the blur, as a real one's
      // do, rather than staying sharp on top of it.
      body.current.style.opacity = String(1 - 0.5 * (spread / BLUR_MAX));
    }
    ghosts.current.forEach((ghost, index) => {
      if (!ghost) return;
      const behind = Math.sign(turning) * spread * ((index + 1) / 4);
      ghost.setAttribute(
        "transform",
        `rotate(${angle.current - behind} 50 50)`,
      );
      ghost.style.opacity = spread < 3 ? "0" : String(GHOST_OPACITIES[index]);
    });
    const current = rpm(turning);
    if (current > best.current) best.current = current;
    if (now - lastReadout.current >= READOUT_EVERY || turning === 0) {
      lastReadout.current = now;
      if (readout.current)
        readout.current.textContent = current.toLocaleString();
      if (bestReadout.current) {
        bestReadout.current.textContent = best.current.toLocaleString();
      }
    }
  };

  const tickFrame = (now: number) => {
    const seconds =
      lastFrame.current === null
        ? 0
        : Math.min((now - lastFrame.current) / 1000, 0.1);
    lastFrame.current = now;
    speed.current = coast(speed.current, seconds);
    angle.current = (angle.current + drawnSpeed(speed.current) * seconds) % 360;
    draw(now);
    if (speed.current !== 0) {
      frame.current = requestAnimationFrame(tickFrameRef.current);
    } else {
      frame.current = undefined;
      lastFrame.current = null;
      keepBest.current();
    }
  };
  const tickFrameRef = useRef(tickFrame);
  tickFrameRef.current = tickFrame;

  // New clicks and flicks become speed, and set it going.
  const speedUp = (next: number) => {
    speed.current = next;
    if (frame.current === undefined && next !== 0) {
      frame.current = requestAnimationFrame(tickFrameRef.current);
    }
  };
  useCountChange(steps, (moved) => speedUp(kick(speed.current, moved)));
  useCountChange(flicks, (moved) => {
    let next = speed.current;
    for (let count = 0; count < moved; count += 1) next = flick(next);
    speedUp(next);
  });

  // Leaving the app stops it, keeping any new best.
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      keepBest.current();
    },
    [],
  );

  return (
    <div
      {...swipe}
      className="relative h-full touch-none overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#e6eaf0_100%)]"
    >
      <button
        aria-label="Flick the spinner"
        className="absolute top-[5px] left-1/2 size-[100px] -translate-x-1/2 cursor-pointer rounded-full outline-none"
        onClick={onFlick}
        // For pointers; from the keyboard the centre button flicks it.
        tabIndex={-1}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="size-full overflow-visible"
          viewBox="0 0 100 100"
        >
          <SpinnerDefs ids={ids} spinner={looks.spinner} />
          {GHOST_OPACITIES.map((opacity, index) => (
            <use
              href={`#${ids.shape}`}
              key={opacity}
              ref={(ghost) => {
                ghosts.current[index] = ghost;
              }}
              style={{ opacity: 0 }}
            />
          ))}
          {/* The shadow stays put while the body turns inside it. */}
          <g className="drop-shadow-[0_1.5px_1.5px_rgb(0_0_0/.35)]">
            <use href={`#${ids.shape}`} ref={body} />
          </g>
          <SpinnerCap face={looks.face} ids={ids} />
        </svg>
        <HapticTap />
      </button>
      <div className="pointer-events-none absolute inset-x-2.5 bottom-1 flex items-baseline justify-between leading-none">
        <span className="text-[#141414]">
          <span className="text-[15px] font-bold tabular-nums" ref={readout}>
            0
          </span>{" "}
          <span className="text-[9px] font-semibold tracking-[.06em] text-[#6d6d6d]">
            RPM
          </span>
        </span>
        <span className="text-[10px] text-[#6d6d6d]">
          Best{" "}
          <span className="font-semibold tabular-nums" ref={bestReadout}>
            {storedBest.toLocaleString()}
          </span>
        </span>
      </div>
    </div>
  );
}
