import {
  type CSSProperties,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { cx } from "../../../../lib/class-names";
import { useClickSwallow } from "../use-click-swallow";
import type { HoldZone } from "./machine";
import { angleDelta, DEGREES_PER_STEP, takeSteps } from "./menu";

type Zone = "menu" | "previous" | "next" | "play" | "center";

/** Inside this radius the angle to the centre is too jumpy to follow. */
const DEAD_RADIUS = 20;

/**
 * How long a button must be held before it does its second job, as on the
 * original: ⏮ and ⏭ rewind and fast-forward, Menu turns the backlight off
 * or on, and play puts the player to sleep.
 */
const holdDelays: Record<HoldZone, number> = {
  previous: 450,
  next: 450,
  menu: 900,
  play: 1_400,
};

/** A press rocks the wheel toward the thumb, as the real one did. */
const tilts: Record<Zone, string> = {
  menu: "rotateX(7deg)",
  play: "rotateX(-7deg)",
  previous: "rotateY(-7deg)",
  next: "rotateY(7deg)",
  center: "scale(0.985)",
};

const zoneButton =
  "absolute grid cursor-pointer touch-manipulation place-items-center text-(--pod-print) outline-none transition-opacity duration-100 active:opacity-60 focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-[#3a86ea]/70";

/** The wheel's printed marks: |◀◀ and ▶▶|, drawn as the original's were. */
function SkipGlyph({ direction }: { direction: "back" | "forward" }) {
  return (
    <svg
      aria-hidden="true"
      className={direction === "back" ? "-scale-x-100" : undefined}
      fill="currentColor"
      height="9"
      viewBox="0 0 17 9"
      width="17"
    >
      <path d="M0 0.5 6.5 4.5 0 8.5Z" />
      <path d="M6.5 0.5 13 4.5 6.5 8.5Z" />
      <rect height="8" rx="0.4" width="2" x="14" y="0.5" />
    </svg>
  );
}

function PlayPauseGlyph() {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height="9"
      viewBox="0 0 16 9"
      width="16"
    >
      <path d="M0 0.5 6.5 4.5 0 8.5Z" />
      <rect height="8" rx="0.4" width="2.2" x="9" y="0.5" />
      <rect height="8" rx="0.4" width="2.2" x="13" y="0.5" />
    </svg>
  );
}

/**
 * The click wheel. Circling a thumb (or pointer) around the ring scrolls,
 * one click every fifteen degrees, clockwise for down; there is no up or
 * down button, as on the original. The four compass points and the centre
 * are buttons, and the compass points also answer being held. A turn that
 * starts on a button does not press it, and neither does a hold.
 */
export function ClickWheel({
  onHoldEnd,
  onHoldStart,
  onMenu,
  onNext,
  onPlayPause,
  onPrevious,
  onSelect,
  onStep,
  playing,
}: {
  onHoldEnd: (zone: HoldZone) => void;
  onHoldStart: (zone: HoldZone) => void;
  onMenu: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onPrevious: () => void;
  onSelect: () => void;
  onStep: (steps: number) => void;
  playing: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const turn = useRef<{
    id: number;
    angle: number;
    travel: number;
    turned: boolean;
  } | null>(null);
  const swallow = useClickSwallow();
  const [pressed, setPressed] = useState<Zone | null>(null);
  const holdTimer = useRef<number>(undefined);
  const holding = useRef<HoldZone | null>(null);
  const holdEnd = useRef(onHoldEnd);
  holdEnd.current = onHoldEnd;

  const cancelHold = () => window.clearTimeout(holdTimer.current);

  // A hold still running when the wheel goes away ends with it.
  useEffect(
    () => () => {
      window.clearTimeout(holdTimer.current);
      if (holding.current) holdEnd.current(holding.current);
    },
    [],
  );

  const locate = (event: PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return { angle: 0, radius: 0 };
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    return {
      angle: (Math.atan2(y, x) * 180) / Math.PI,
      radius: Math.hypot(x, y),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swallow.disarm();
    if (event.button !== 0) return;
    const zone = (event.target as Element).closest<HTMLElement>("[data-zone]")
      ?.dataset.zone as Zone | undefined;
    setPressed(zone ?? null);
    if (zone === "center") return;
    const pointerId = event.pointerId;
    turn.current = {
      id: pointerId,
      angle: locate(event).angle,
      travel: 0,
      turned: false,
    };
    if (!zone) return;
    cancelHold();
    holdTimer.current = window.setTimeout(() => {
      if (turn.current?.id !== pointerId || turn.current.turned) return;
      holding.current = zone;
      // Keep the release even if the pointer drifts off the wheel.
      try {
        ref.current?.setPointerCapture(pointerId);
      } catch {
        // The pointer is already gone.
      }
      onHoldStart(zone);
    }, holdDelays[zone]);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = turn.current;
    if (!current || current.id !== event.pointerId) return;
    const { angle, radius } = locate(event);
    const delta = angleDelta(current.angle, angle);
    current.angle = angle;
    if (radius < DEAD_RADIUS) return;
    current.travel += delta;
    const { steps, rest } = takeSteps(current.travel, DEGREES_PER_STEP);
    if (steps === 0) return;
    current.travel = rest;
    if (holding.current) return;
    if (!current.turned) {
      current.turned = true;
      cancelHold();
      setPressed(null);
      try {
        ref.current?.setPointerCapture(event.pointerId);
      } catch {
        // The pointer already left; move events still arrive.
      }
    }
    onStep(steps);
  };

  const handlePointerEnd = () => {
    const current = turn.current;
    const held = holding.current;
    turn.current = null;
    holding.current = null;
    cancelHold();
    setPressed(null);
    if (held) onHoldEnd(held);
    // A turn or a hold that began on a button does not also press it.
    if (current?.turned || held) swallow.arm();
  };

  return (
    <div
      className="relative size-[164px] touch-none select-none [perspective:420px]"
      onClickCapture={swallow.onClickCapture}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerLeave={() => {
        if (!turn.current?.turned) setPressed(null);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      ref={ref}
    >
      <div
        className="absolute inset-0 rounded-full bg-(--pod-wheel) transition-transform duration-150 ease-soft motion-reduce:transition-none"
        style={
          {
            boxShadow:
              "inset 0 1px 2px var(--pod-wheel-edge), inset 0 -1px 0 var(--pod-rim), 0 1px 0 var(--pod-rim)",
            transform: pressed && pressed !== "center" ? tilts[pressed] : "",
          } as CSSProperties
        }
      >
        <button
          aria-label="Menu"
          className={cx(
            zoneButton,
            "inset-x-0 top-0 mx-auto h-[50px] w-[80px]",
          )}
          data-zone="menu"
          onClick={onMenu}
          type="button"
        >
          <span className="font-pod text-[10.5px] font-bold tracking-[.06em]">
            MENU
          </span>
        </button>
        <button
          aria-label="Previous song"
          className={cx(
            zoneButton,
            "inset-y-0 left-0 my-auto h-[80px] w-[50px]",
          )}
          data-zone="previous"
          onClick={onPrevious}
          type="button"
        >
          <SkipGlyph direction="back" />
        </button>
        <button
          aria-label="Next song"
          className={cx(
            zoneButton,
            "inset-y-0 right-0 my-auto h-[80px] w-[50px]",
          )}
          data-zone="next"
          onClick={onNext}
          type="button"
        >
          <SkipGlyph direction="forward" />
        </button>
        <button
          aria-label={playing ? "Pause the music" : "Play the music"}
          className={cx(
            zoneButton,
            "inset-x-0 bottom-0 mx-auto h-[50px] w-[80px]",
          )}
          data-zone="play"
          onClick={onPlayPause}
          type="button"
        >
          <PlayPauseGlyph />
        </button>
      </div>
      <button
        aria-label="Select"
        className="absolute inset-0 m-auto size-[62px] cursor-pointer touch-manipulation rounded-full bg-(image:--pod-center) outline-none transition-transform duration-100 ease-soft focus-visible:ring-2 focus-visible:ring-[#3a86ea]/70 active:scale-[.97]"
        data-zone="center"
        onClick={onSelect}
        style={{
          boxShadow:
            "0 0 0 1px var(--pod-wheel-edge), 0 1px 2px rgb(0 0 0 / 0.12), inset 0 1px 0 var(--pod-rim)",
        }}
        type="button"
      />
    </div>
  );
}
