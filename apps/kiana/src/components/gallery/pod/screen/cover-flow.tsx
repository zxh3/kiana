import { HapticTap } from "../../haptic-tap";
import { type Track, trackArt } from "../../music/music-track";
import { useSwipeSteps } from "../use-swipe-steps";

const COVER = 70;
/** How far the first cover to either side sits from the middle, and each after it. */
const FIRST_GAP = 46;
const NEXT_GAP = 15;
/** Covers further out than this are hidden. */
const REACH = 4;
/** Swipe distance that moves one cover. */
const SWIPE_STEP = 34;

/**
 * Cover Flow: the songs' covers in a row, the chosen one facing forward and
 * the rest turned away on either side, each with its reflection. The wheel
 * or a sideways swipe flips through them; a tap on a side cover brings it
 * to the middle, and a tap on the middle one (or the centre button) plays
 * it.
 */
export function CoverFlow({
  current,
  onPick,
  onStep,
  selected,
  tracks,
}: {
  current: number;
  onPick: (index: number) => void;
  onStep: (steps: number) => void;
  selected: number;
  tracks: ReadonlyArray<Track>;
}) {
  const track = tracks[selected];
  const swipe = useSwipeSteps<HTMLDivElement>({
    axis: "x",
    onStep,
    size: SWIPE_STEP,
  });
  return (
    <div
      {...swipe}
      className="absolute inset-0 touch-none overflow-hidden bg-[radial-gradient(120%_85%_at_50%_0%,#303034_0%,#050505_72%)]"
    >
      <div
        className="absolute inset-x-0 top-3 [perspective:260px]"
        style={{ height: COVER }}
      >
        {tracks.map((item, index) => {
          const offset = index - selected;
          const side = Math.sign(offset);
          const distance = Math.abs(offset);
          const x =
            distance === 0 ? 0 : side * (FIRST_GAP + (distance - 1) * NEXT_GAP);
          return (
            <button
              aria-current={offset === 0 || undefined}
              aria-label={
                offset === 0 ? `Play ${item.title}` : `Show ${item.title}`
              }
              className="absolute top-0 left-1/2 cursor-pointer bg-black transition-[transform,opacity] duration-300 ease-soft outline-none motion-reduce:transition-none"
              key={item.videoId}
              onClick={() => onPick(index)}
              style={{
                width: COVER,
                height: COVER,
                marginLeft: -COVER / 2,
                opacity: distance > REACH ? 0 : 1,
                transform:
                  distance === 0
                    ? "translateX(0) translateZ(0) rotateY(0deg)"
                    : `translateX(${x}px) translateZ(-34px) rotateY(${side * -66}deg)`,
                zIndex: 20 - distance,
                WebkitBoxReflect:
                  "below 1px linear-gradient(transparent 58%, rgb(255 255 255 / 0.3))",
              }}
              // For pointers; from the keyboard the wheel drives the display.
              tabIndex={-1}
              type="button"
            >
              <img
                alt=""
                className="size-full object-cover"
                draggable={false}
                src={trackArt(item)}
              />
              {index === current ? (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#4a95f0]" />
              ) : null}
              <HapticTap />
            </button>
          );
        })}
      </div>
      <div className="absolute inset-x-2 bottom-2 text-center leading-tight text-white">
        <p className="truncate text-[11px] font-bold" lang="zh">
          {track.title}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-white/60" lang="zh">
          {track.artist}
        </p>
      </div>
    </div>
  );
}
