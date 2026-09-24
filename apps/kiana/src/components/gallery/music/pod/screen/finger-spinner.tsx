import { useEffect, useId, useRef } from "react";

import { HapticTap } from "../../../haptic-tap";
import { useStoredState } from "../../../use-stored-state";
import {
  BLUR_MAX,
  blurSpread,
  coast,
  drawnSpeed,
  flick,
  kick,
  parseBestRpm,
  rpm,
} from "../spinner";
import { useSwipeSteps } from "../use-swipe-steps";

/** Swipe distance that counts as one click of the wheel. */
const SWIPE_STEP = 10;
/** Copies trailing the lobes for the motion blur, faintest last. */
const GHOST_OPACITIES = [0.42, 0.28, 0.18, 0.1];
/** How often the readout changes, so the digits stay readable. */
const READOUT_EVERY = 120;

/** The lobes' centres, a third of a turn apart, 29 from the middle. */
const lobes = [-90, 30, 150].map((degrees) => {
  const radians = (degrees * Math.PI) / 180;
  return { x: 50 + 29 * Math.cos(radians), y: 50 + 29 * Math.sin(radians) };
});

/** Ids for one drawing's gradients; React's own ids are not valid in `url()`. */
function useArtIds() {
  const id = useId().replace(/[^\w-]/g, "");
  return { body: `${id}-body`, metal: `${id}-metal`, shape: `${id}-shape` };
}

/** The gradients and the spinning body, for `<use>` to draw. */
function SpinnerDefs({ ids }: { ids: ReturnType<typeof useArtIds> }) {
  return (
    <defs>
      <linearGradient id={ids.body} x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#7cb9f8" />
        <stop offset="0.55" stopColor="#3a86ea" />
        <stop offset="1" stopColor="#1a56b8" />
      </linearGradient>
      <radialGradient cx="0.38" cy="0.32" id={ids.metal} r="0.75">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.5" stopColor="#d4d8de" />
        <stop offset="1" stopColor="#8d949d" />
      </radialGradient>
      {/* Three weighted lobes around a hub, each with its bearing. */}
      <g id={ids.shape}>
        <circle cx="50" cy="50" fill={`url(#${ids.body})`} r="19" />
        {lobes.map((lobe) => (
          <circle
            cx={lobe.x}
            cy={lobe.y}
            fill={`url(#${ids.body})`}
            key={lobe.x}
            r="17"
          />
        ))}
        {lobes.map((lobe) => (
          <g key={lobe.x}>
            <circle
              cx={lobe.x}
              cy={lobe.y}
              fill={`url(#${ids.metal})`}
              r="10.5"
            />
            <circle
              cx={lobe.x}
              cy={lobe.y}
              fill="none"
              r="6.5"
              stroke="rgb(0 0 0 / 0.18)"
            />
          </g>
        ))}
        <circle cx="50" cy="50" fill={`url(#${ids.metal})`} r="12.5" />
      </g>
    </defs>
  );
}

/** The cap in the middle, which a finger holds still while the rest turns. */
function SpinnerCap({ ids }: { ids: ReturnType<typeof useArtIds> }) {
  return (
    <g>
      <circle cx="50" cy="50" fill={`url(#${ids.metal})`} r="8.5" />
      <circle cx="50" cy="50" fill="none" r="5.5" stroke="rgb(0 0 0 / 0.12)" />
    </g>
  );
}

/** A still spinner, for the top menu's preview of Extras. */
export function SpinnerIcon({ size }: { size: number }) {
  const ids = useArtIds();
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 100 100" width={size}>
      <SpinnerDefs ids={ids} />
      <g className="drop-shadow-[0_1.5px_1.5px_rgb(0_0_0/.35)]">
        <use href={`#${ids.shape}`} transform="rotate(12 50 50)" />
      </g>
      <SpinnerCap ids={ids} />
    </svg>
  );
}

/**
 * The finger spinner under Extras. Each click of the wheel flicks it a
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
  onFlick,
  onStep,
  steps,
}: {
  /** Flicks so far, counted up by the player. */
  flicks: number;
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
  // Only what happens from now on moves it: the counts it opens on are old.
  const seen = useRef({ steps, flicks });
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
  useEffect(() => {
    const newSteps = steps - seen.current.steps;
    const newFlicks = flicks - seen.current.flicks;
    seen.current = { steps, flicks };
    if (!newSteps && !newFlicks) return;
    let next = kick(speed.current, newSteps);
    for (let count = 0; count < newFlicks; count += 1) next = flick(next);
    speed.current = next;
    if (frame.current === undefined && next !== 0) {
      frame.current = requestAnimationFrame(tickFrameRef.current);
    }
  }, [steps, flicks]);

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
          <SpinnerDefs ids={ids} />
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
          <SpinnerCap ids={ids} />
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
