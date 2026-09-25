import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { cx } from "../../../../lib/class-names";
import { setTouchSwitch } from "../../../../lib/haptics";
import { HapticTap, switchAttribute, useOnIos } from "../../haptic-tap";
import { useClickSwallow } from "../../music/use-click-swallow";
import {
  angleDelta,
  DEGREES_PER_STEP,
  type HoldZone,
  takeSteps,
  wheelZoneAt,
} from "./wheel";

type Zone = "menu" | "previous" | "next" | "play" | "center";

/** Inside this radius the angle to the centre is too jumpy to follow. */
const DEAD_RADIUS = 20;
/**
 * How far to one side of the finger the ring's switch keeps its middle on
 * iPhones: far enough that the finger's own wobble never crosses it.
 */
const SWITCH_SIDE = 24;
/**
 * The ring's switch becomes a long, thin strip once a finger is on it.
 * Until a dragged switch first flips, WebKit moves the flip point 40% of
 * its width past where the finger landed, unless the finger landed in the
 * part of the track the knob does not cover (its width less its height).
 * A strip this wide and thin always has the finger there, so the first
 * click flips it like every other.
 */
const STRIP_WIDTH = 600;
const STRIP_HEIGHT = 12;

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
 *
 * On iPhones an invisible native switch covers the ring, so the wheel's
 * clicks can be felt (see `lib/haptics.ts`): while a finger is down the
 * switch keeps its middle just beside it, and each click moves the middle
 * to the finger's other side, which Safari answers with a tap. Safari only
 * starts following a finger on a switch 200ms after it lands, so the first
 * click of a quick turn can go unfelt. A tap on the ring lands on the
 * switch, so it presses the button under it by position.
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
  const ios = useOnIos();
  const ringSwitch = useRef<HTMLInputElement>(null);
  // A fresh switch for every touch: WebKit's timer for a held switch keeps
  // the first touch it ever saw and measures later drags from where that
  // one landed.
  const [switchKey, setSwitchKey] = useState(0);
  /** Where the finger on the ring's switch is, and which side of it the middle keeps. */
  const follow = useRef<{ x: number; right: boolean } | null>(null);
  const releaseSwitch = useRef<() => void>(undefined);
  /** The button a tap on the ring's switch would press, until it turns or holds. */
  const switchTap = useRef<HoldZone | null>(null);

  const cancelHold = () => window.clearTimeout(holdTimer.current);

  // A hold still running when the wheel goes away ends with it.
  useEffect(
    () => () => {
      window.clearTimeout(holdTimer.current);
      if (holding.current) holdEnd.current(holding.current);
      releaseSwitch.current?.();
    },
    [],
  );

  /** Keeps the switch's middle beside the finger, on the side it holds. */
  const placeSwitch = () => {
    const input = ringSwitch.current;
    const rect = ref.current?.getBoundingClientRect();
    if (!follow.current || !input || !rect) return;
    const { x, right } = follow.current;
    input.style.left = `${x - rect.left + (right ? -SWITCH_SIDE : SWITCH_SIDE)}px`;
  };

  const followFinger = (x: number) => {
    const input = ringSwitch.current;
    if (!input) return;
    input.style.width = `${STRIP_WIDTH}px`;
    input.style.height = `${STRIP_HEIGHT}px`;
    // A switch that is on stays on while the finger is right of its middle.
    follow.current = { x, right: input.checked };
    placeSwitch();
    releaseSwitch.current = setTouchSwitch(() => {
      if (!follow.current) return;
      follow.current.right = !follow.current.right;
      placeSwitch();
    });
  };

  const stopFollowing = () => {
    if (!follow.current) return;
    follow.current = null;
    releaseSwitch.current?.();
    // A new switch under the ring once Safari has finished with the touch,
    // so that moving it cannot flip the old one a last time.
    window.setTimeout(() => {
      if (!follow.current) setSwitchKey((key) => key + 1);
    }, 50);
  };

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
    const onSwitch = event.target === ringSwitch.current;
    const zone = onSwitch
      ? wheelZoneAt(locate(event).angle)
      : ((event.target as Element).closest<HTMLElement>("[data-zone]")?.dataset
          .zone as Zone | undefined);
    if (onSwitch) {
      switchTap.current = zone as HoldZone;
      followFinger(event.clientX);
    }
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
    if (follow.current) follow.current.x = event.clientX;
    turnWith(event);
    // After the turn, which may have moved the middle across for a click.
    placeSwitch();
  };

  const turnWith = (event: PointerEvent<HTMLDivElement>) => {
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
    stopFollowing();
    if (held) onHoldEnd(held);
    // A turn or a hold that began on a button does not also press it.
    if (current?.turned || held) {
      swallow.arm();
      switchTap.current = null;
    }
  };

  const presses: Record<HoldZone, () => void> = {
    menu: onMenu,
    previous: onPrevious,
    next: onNext,
    play: onPlayPause,
  };

  // A tap on the ring's switch presses the button under it. The swallow is
  // left out: cancelling the switch's click would undo its toggle, and
  // `switchTap` already forgets a turn or a hold.
  const handleSwitchClick = (event: MouseEvent) => {
    event.stopPropagation();
    swallow.disarm();
    const zone = switchTap.current;
    switchTap.current = null;
    if (zone) presses[zone]();
  };

  return (
    <div
      className="relative size-[164px] touch-none select-none [perspective:420px]"
      onClickCapture={(event) => {
        if (event.target !== ringSwitch.current) swallow.onClickCapture(event);
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
      {ios ? (
        <input
          {...switchAttribute}
          aria-hidden="true"
          // Drawn not at all: Safari taps from the switch's logic, whatever
          // it looks like.
          className="absolute top-1/2 left-1/2 m-0 size-full -translate-x-1/2 -translate-y-1/2 cursor-pointer appearance-none opacity-0 [-webkit-tap-highlight-color:transparent] [clip-path:circle(50%)]"
          key={switchKey}
          onClick={handleSwitchClick}
          ref={ringSwitch}
          tabIndex={-1}
          type="checkbox"
        />
      ) : null}
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
      >
        <HapticTap />
      </button>
    </div>
  );
}
