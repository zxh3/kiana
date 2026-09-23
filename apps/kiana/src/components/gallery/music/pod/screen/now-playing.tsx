import { type PointerEvent, type ReactNode, useRef } from "react";

import { cx } from "../../../../../lib/class-names";
import {
  RepeatIcon,
  ShuffleIcon,
  SoundOffIcon,
  SoundOnIcon,
} from "../../../icons";
import { Marquee } from "../../marquee";
import type { PlayMode } from "../../music-queue";
import { type Track, trackArt } from "../../music-track";
import { formatPodTime } from "../format";

export type NowOverlay = "volume" | "scrub" | null;

/**
 * A bar the touch screen can set: press or drag along it, and `onChange`
 * hears where, as a fraction, with `done` on release.
 */
function TouchBar({
  children,
  onChange,
}: {
  children: ReactNode;
  onChange: (fraction: number, done: boolean) => void;
}) {
  const pressed = useRef<number | null>(null);
  const fraction = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return (event.clientX - rect.left) / rect.width;
  };
  return (
    // A touch shortcut, hidden from assistive technology: the wheel and the
    // arrow keys set the same value.
    <div
      aria-hidden="true"
      className="-my-2 cursor-pointer touch-none py-2"
      onPointerCancel={() => {
        pressed.current = null;
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        pressed.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        onChange(fraction(event), false);
      }}
      onPointerMove={(event) => {
        if (pressed.current === event.pointerId) {
          onChange(fraction(event), false);
        }
      }}
      onPointerUp={(event) => {
        if (pressed.current !== event.pointerId) return;
        pressed.current = null;
        onChange(fraction(event), true);
      }}
    >
      {children}
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

/**
 * Now Playing: the cover with its reflection, the song, and a progress bar.
 * Turning the wheel here shows the volume instead; the centre button swaps
 * in the scrubber. On the touch screen, pressing or dragging along the bar
 * seeks, or sets the volume while that is showing.
 */
export function NowPlaying({
  count,
  current,
  duration,
  index,
  loading,
  mode,
  onSeek,
  onVolume,
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
  onSeek: (fraction: number, done: boolean) => void;
  onVolume: (fraction: number) => void;
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
      <div className="absolute inset-x-2.5 bottom-2 flex h-[22px] flex-col justify-end">
        {overlay === "volume" ? (
          <div className="flex items-center gap-1.5 pb-1 text-[#777]">
            <SoundOffIcon size={13} />
            <div className="flex-1">
              <TouchBar onChange={(fraction) => onVolume(fraction)}>
                <Bar percent={volume} />
              </TouchBar>
            </div>
            <SoundOnIcon size={13} />
          </div>
        ) : (
          <>
            <TouchBar onChange={onSeek}>
              <Bar marker={overlay === "scrub"} percent={percent} />
            </TouchBar>
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
