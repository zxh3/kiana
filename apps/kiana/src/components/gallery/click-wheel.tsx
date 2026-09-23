import {
  type CSSProperties,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import { cx } from "../../lib/class-names";
import { angleDelta, DEGREES_PER_STEP, takeSteps } from "./ipod-menu";

type Zone = "menu" | "previous" | "next" | "play" | "center";

/** Scroll distance that counts as one click of the wheel. */
const PIXELS_PER_STEP = 40;
/** Inside this radius the angle to the centre is too jumpy to follow. */
const DEAD_RADIUS = 20;

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
 * Scrolling over `ref` turns the wheel, so a mouse wheel or a trackpad
 * works like a thumb.
 */
export function useScrollSteps(
  ref: RefObject<HTMLElement | null>,
  onStep: (steps: number) => void,
) {
  const latest = useRef(onStep);
  latest.current = onStep;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let travel = 0;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      travel += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const { steps, rest } = takeSteps(travel, PIXELS_PER_STEP);
      travel = rest;
      if (steps !== 0) latest.current(steps);
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [ref]);
}

/**
 * The click wheel. Circling a thumb (or pointer) around the ring scrolls,
 * one click every fifteen degrees, clockwise for down. The four compass
 * points and the centre are buttons, and a turn that starts on one of them
 * does not press it.
 */
export function ClickWheel({
  onMenu,
  onNext,
  onPlayPause,
  onPrevious,
  onSelect,
  onStep,
  playing,
}: {
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
  const swallowClick = useRef(false);
  const [pressed, setPressed] = useState<Zone | null>(null);

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
    // The wheel turns; it never drags the player around the screen.
    event.stopPropagation();
    if (event.button !== 0) return;
    const zone = (event.target as Element).closest<HTMLElement>("[data-zone]")
      ?.dataset.zone as Zone | undefined;
    setPressed(zone ?? null);
    if (zone === "center") return;
    turn.current = {
      id: event.pointerId,
      angle: locate(event).angle,
      travel: 0,
      turned: false,
    };
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
    if (!current.turned) {
      current.turned = true;
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
    turn.current = null;
    setPressed(null);
    if (!current?.turned) return;
    swallowClick.current = true;
    window.setTimeout(() => {
      swallowClick.current = false;
    }, 0);
  };

  return (
    <div
      className="relative size-[164px] touch-none select-none [perspective:420px]"
      onClickCapture={(event) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
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
          title="Menu"
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
          title="Previous song"
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
          title="Next song"
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
          title={playing ? "Pause" : "Play"}
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
        title="Select"
        type="button"
      />
    </div>
  );
}
