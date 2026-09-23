import type { GalleryAsset } from "../../data/photos";
import { cx } from "../../lib/class-names";
import { PauseIcon } from "./icons";
import {
  formatAgo,
  formatClockTime,
  formatMediaDuration,
  formatPhotoDate,
  formatWeekday,
} from "./model";

function describe(asset: GalleryAsset, today: string) {
  const parts: string[] = [];
  if (asset.date) parts.push(formatWeekday(asset.date));
  if (asset.time) parts.push(formatClockTime(asset.time));
  if (asset.date) parts.push(formatAgo(asset.date, today));
  if (asset.type === "live_photo") parts.push("Live");
  if (asset.type === "video" && asset.video) {
    parts.push(`Video ${formatMediaDuration(asset.video.durationMs)}`);
  }
  // Phrases never split; a line may only break after a separator.
  return parts
    .map((part) => part.replaceAll(" ", "\u00a0"))
    .join("\u00a0\u00a0·  ");
}

/**
 * The date is always present, like a caption under a print. The details line
 * joins it when the controls are up, and the caption rises to make room.
 */
export function Caption({
  asset,
  expanded,
  mat,
  paused,
  today,
}: {
  asset: GalleryAsset;
  expanded: boolean;
  mat: boolean;
  paused: boolean;
  today: string;
}) {
  const date = formatPhotoDate(asset.date);

  return (
    <div
      className={cx(
        "pointer-events-none absolute inset-x-0 bottom-[calc(30px+env(safe-area-inset-bottom))] z-10 flex flex-col items-center px-6 text-center transition-[translate,color] duration-500 ease-soft",
        // Wide screens hang the caption bottom-left like a wall label, clear
        // of the centered controls (and of the macOS Dock on the wallpaper).
        "lg:right-auto lg:bottom-[30px] lg:left-[max(28px,env(safe-area-inset-left))] lg:max-w-[min(420px,calc(50vw-252px))] lg:items-start lg:px-0 lg:text-left",
        expanded && "-translate-y-[76px] lg:translate-y-0",
        mat
          ? "text-ink"
          : "text-paper [text-shadow:0_1px_16px_rgba(0,0,0,.45)]",
      )}
    >
      <p
        aria-hidden={!paused}
        className={cx(
          "label mb-3 flex items-center gap-1.5 transition-opacity duration-300",
          paused ? "opacity-70" : "opacity-0",
        )}
      >
        <PauseIcon size={10} />
        Paused
      </p>
      <p
        aria-live="polite"
        className={cx(
          "font-serif text-[23px] leading-none italic sm:text-[27px]",
          mat ? "opacity-80" : "opacity-92",
        )}
      >
        {date || "Undated"}
      </p>
      <p
        className={cx(
          "label mt-3 min-h-[10px] whitespace-pre-wrap leading-[1.6] transition-opacity duration-500 max-sm:text-[9px] max-sm:tracking-[.16em]",
          expanded ? "opacity-62" : "opacity-0",
        )}
      >
        {describe(asset, today)}
      </p>
    </div>
  );
}
