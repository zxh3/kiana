import { type Track, trackArt } from "../../music-track";

const COVER = 70;
/** How far the first cover to either side sits from the middle, and each after it. */
const FIRST_GAP = 46;
const NEXT_GAP = 15;
/** Covers further out than this are hidden. */
const REACH = 4;

/**
 * Cover Flow: the songs' covers in a row, the chosen one facing forward and
 * the rest turned away on either side, each with its reflection. The wheel
 * flips through them and the centre button plays the middle one.
 */
export function CoverFlow({
  current,
  selected,
  tracks,
}: {
  current: number;
  selected: number;
  tracks: ReadonlyArray<Track>;
}) {
  const track = tracks[selected];
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_85%_at_50%_0%,#303034_0%,#050505_72%)]">
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
            <div
              aria-hidden="true"
              className="absolute top-0 left-1/2 bg-black transition-[transform,opacity] duration-300 ease-soft outline-none motion-reduce:transition-none"
              key={item.videoId}
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
            </div>
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
