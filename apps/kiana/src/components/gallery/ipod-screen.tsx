import { useRef } from "react";

import { cx } from "../../lib/class-names";
import { RepeatIcon, ShuffleIcon, SoundOffIcon, SoundOnIcon } from "./icons";
import { scrollWindow, VISIBLE_ROWS } from "./ipod-menu";
import { Marquee } from "./marquee";
import type { PlayMode } from "./music-queue";
import { type Track, trackArt } from "./music-track";

/**
 * The pocket player's colour screen: grey title bar, white lists, and the
 * glossy blue highlight. Its colours are its own, like a device's display,
 * rather than the gallery's.
 */

const ROW_HEIGHT = 19;

/** The glossy two-tone highlight of the selected row. */
const highlight =
  "bg-[linear-gradient(180deg,#72b3f9_0%,#4390ee_48%,#2d7ae3_52%,#3584ea_100%)] text-white [text-shadow:0_-1px_0_rgb(0_0_0/.18)]";

/** "3:07", the way the player writes times. */
export function formatPodTime(seconds: number) {
  const total =
    Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function StateGlyph({ state }: { state: "playing" | "paused" | "none" }) {
  if (state === "none") return null;
  return (
    <svg
      aria-hidden="true"
      className="fill-[#2d7ae3]"
      height="8"
      viewBox="0 0 8 8"
      width="8"
    >
      {state === "playing" ? (
        <path d="M1 0.5 7.5 4 1 7.5Z" />
      ) : (
        <>
          <rect height="7" width="2.4" x="1" y="0.5" />
          <rect height="7" width="2.4" x="4.6" y="0.5" />
        </>
      )}
    </svg>
  );
}

function Battery() {
  return (
    <svg aria-hidden="true" height="9" viewBox="0 0 19 9" width="19">
      <defs>
        <linearGradient id="pod-charge" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#9be07a" />
          <stop offset="0.5" stopColor="#5cbf3a" />
          <stop offset="1" stopColor="#48a82c" />
        </linearGradient>
      </defs>
      <rect
        fill="#fff"
        height="8"
        rx="1.5"
        stroke="#7d7d7d"
        width="16"
        x="0.5"
        y="0.5"
      />
      <rect
        fill="url(#pod-charge)"
        height="6"
        rx="0.8"
        width="13"
        x="1.5"
        y="1.5"
      />
      <rect fill="#7d7d7d" height="3.5" rx="0.6" width="1.6" x="17" y="2.75" />
    </svg>
  );
}

export function StatusBar({
  state,
  title,
}: {
  state: "playing" | "paused" | "none";
  title: string;
}) {
  return (
    <div className="relative flex h-[18px] shrink-0 items-center justify-center border-b border-[#8e8e8e] bg-[linear-gradient(180deg,#fefefe_0%,#e4e4e4_55%,#cdcdcd_100%)] px-1.5">
      <span className="absolute left-1.5 flex">
        <StateGlyph state={state} />
      </span>
      <span className="text-[11px] leading-none font-bold text-[#1b1b1b]">
        {title}
      </span>
      <span className="absolute right-1.5 flex">
        <Battery />
      </span>
    </div>
  );
}

export type PodRow = {
  key: string;
  label: string;
  /** A setting's current value, written on the right. */
  detail?: string;
  /** Opens another screen. */
  opens?: boolean;
  /** The song that is playing. */
  current?: boolean;
  lang?: string;
};

function Speaker({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height="9"
      viewBox="0 0 11 9"
      width="11"
    >
      <path d="M0 3h2.2L5 0.6v7.8L2.2 6H0Z" />
      <path
        d="M6.8 2.3a3 3 0 0 1 0 4.4M8.6 0.9a5 5 0 0 1 0 7.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A menu list. The highlight follows the wheel and, with a mouse, the
 * pointer; a tap or click picks the row.
 */
export function PodList({
  label,
  onHover,
  onPick,
  rows,
  selected,
}: {
  label: string;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
  rows: ReadonlyArray<PodRow>;
  selected: number;
}) {
  // The window scrolls only when the highlight would leave it; recomputing
  // it from the last window during render keeps it in step with the wheel.
  const first = useRef(0);
  first.current = scrollWindow(first.current, selected, rows.length);
  const scrolls = rows.length > VISIBLE_ROWS;

  return (
    <div className="relative h-full overflow-hidden">
      <ol
        aria-label={label}
        className="transition-transform duration-100 ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(${-first.current * ROW_HEIGHT}px)` }}
      >
        {rows.map((row, index) => {
          const active = index === selected;
          return (
            <li key={row.key}>
              <button
                aria-current={active || undefined}
                className={cx(
                  "flex w-full cursor-pointer items-center gap-1.5 pr-1.5 pl-2 text-left text-[12px] leading-none outline-none",
                  scrolls && "pr-3",
                  active ? highlight : "text-[#141414]",
                )}
                onClick={() => onPick(index)}
                onFocus={() => onHover(index)}
                onPointerMove={(event) => {
                  if (event.pointerType === "mouse" && !active) onHover(index);
                }}
                style={{ height: ROW_HEIGHT }}
                type="button"
              >
                <span
                  className="min-w-0 flex-1 truncate font-semibold"
                  lang={row.lang}
                >
                  {row.label}
                </span>
                {row.current ? (
                  <Speaker
                    className={active ? "text-white" : "text-[#2d7ae3]"}
                  />
                ) : null}
                {row.detail ? (
                  <span
                    className={cx(
                      "shrink-0 text-[11px]",
                      active ? "text-white/90" : "text-[#6d6d6d]",
                    )}
                  >
                    {row.detail}
                  </span>
                ) : null}
                {row.opens ? (
                  <span
                    aria-hidden="true"
                    className={cx(
                      "-mt-px shrink-0 text-[13px] font-bold",
                      active ? "text-white" : "text-[#9a9a9a]",
                    )}
                  >
                    ›
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
      {scrolls ? (
        <div className="absolute inset-y-0 right-0 w-[7px] border-l border-[#bdbdbd] bg-[linear-gradient(90deg,#e9e9e9,#fbfbfb)]">
          <div
            className="absolute inset-x-[1px] rounded-[2px] bg-[linear-gradient(90deg,#7fb6f5,#3584ea)]"
            style={{
              top: `${(first.current / rows.length) * 100}%`,
              height: `${(VISIBLE_ROWS / rows.length) * 100}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** The cover of the playing song, drifting slowly beside the top menu. */
export function MenuPreview({ track }: { track: Track }) {
  return (
    <div className="relative h-full overflow-hidden border-l border-[#9d9d9d] bg-black">
      <img
        alt=""
        className="absolute inset-0 size-full animate-pod-pan object-cover motion-reduce:animate-none"
        draggable={false}
        key={track.videoId}
        src={trackArt(track)}
      />
    </div>
  );
}

function Bar({ percent, marker }: { percent: number; marker?: boolean }) {
  return (
    <div className="relative">
      <div className="h-[7px] overflow-hidden rounded-[2px] border border-[#8c8c8c] bg-[linear-gradient(180deg,#fafafa,#d3d3d3)]">
        <div
          className={cx(
            "h-full",
            marker
              ? "bg-[linear-gradient(180deg,#c9dff8,#9cc2ee)]"
              : "bg-[linear-gradient(180deg,#8ec3fa_0%,#3f89e8_55%,#2b73d8_100%)]",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {marker ? (
        <span
          className="absolute top-1/2 size-[9px] -translate-x-1/2 -translate-y-1/2 rotate-45 border border-[#1f5fbf] bg-white shadow-[0_1px_1px_rgb(0_0_0/.25)]"
          style={{ left: `${percent}%` }}
        />
      ) : null}
    </div>
  );
}

export type NowOverlay = "volume" | "scrub" | null;

/**
 * Now Playing: the cover with its reflection, the song, and a progress bar.
 * Turning the wheel here shows the volume instead; the centre button swaps
 * in the scrubber.
 */
export function NowPlaying({
  count,
  current,
  duration,
  index,
  loading,
  mode,
  overlay,
  track,
  volume,
}: {
  count: number;
  current: number;
  duration: number;
  index: number;
  loading: boolean;
  mode: PlayMode;
  overlay: NowOverlay;
  track: Track;
  volume: number;
}) {
  const percent = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  return (
    <div className="absolute inset-0 px-2.5 pt-1.5 text-[#141414]">
      <div className="flex h-3 items-center justify-between text-[10px] text-[#666]">
        <span className="tabular-nums">
          {index + 1} of {count}
        </span>
        {mode === "shuffle" ? (
          <ShuffleIcon className="text-[#2d7ae3]" size={12} />
        ) : (
          <RepeatIcon
            className="text-[#2d7ae3]"
            one={mode === "one"}
            size={12}
          />
        )}
      </div>
      <div className="mt-1.5 flex gap-2.5">
        <div className="relative w-[60px] shrink-0">
          <img
            alt=""
            className="block size-[60px] object-cover shadow-[0_1px_3px_rgb(0_0_0/.35)]"
            draggable={false}
            src={trackArt(track)}
          />
          {/* The reflection on the glossy floor beneath the cover. */}
          <img
            alt=""
            aria-hidden="true"
            className="block h-[18px] w-[60px] -scale-y-100 object-cover object-bottom opacity-35 [mask-image:linear-gradient(to_top,black,transparent)]"
            draggable={false}
            src={trackArt(track)}
          />
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <Marquee>
            <span className="text-[12.5px] leading-tight font-bold" lang="zh">
              {track.title}
            </span>
          </Marquee>
          <p className="mt-1 truncate text-[11px] text-[#555]" lang="zh">
            {track.artist}
          </p>
        </div>
      </div>
      <div className="absolute inset-x-2.5 bottom-2">
        {overlay === "volume" ? (
          <div className="flex items-center gap-1.5 text-[#777]">
            <SoundOffIcon size={13} />
            <div className="flex-1">
              <Bar percent={volume} />
            </div>
            <SoundOnIcon size={13} />
          </div>
        ) : (
          <>
            <Bar marker={overlay === "scrub"} percent={percent} />
            <div className="mt-1 flex justify-between text-[10px] leading-none text-[#333] tabular-nums">
              <span>{loading ? "Loading…" : formatPodTime(current)}</span>
              <span>-{formatPodTime(Math.max(0, duration - current))}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
