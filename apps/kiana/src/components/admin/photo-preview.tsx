import { useEffect, useRef } from "react";

import type { GalleryAsset } from "../../data/photos";
import { cx } from "../../lib/class-names";
import type { HiddenPhoto } from "../../lib/hidden-photos";
import { ControlButton, focusRing } from "../gallery/control-button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  EyeIcon,
  EyeOffIcon,
  LiveIcon,
} from "../gallery/icons";
import { formatClockTime, formatPhotoDate } from "../gallery/model";
import { Toast, type ToastMessage } from "../gallery/toast";
import { describeHidden } from "./admin-photos";

const numberFormatter = new Intl.NumberFormat("en-US");

const kindLabels: Record<GalleryAsset["type"], string> = {
  photo: "Photo",
  live_photo: "Live Photo",
  video: "Video",
};

/**
 * One photo, large, to look at before hiding it or showing it again. The
 * arrow keys step through the grid, H hides or shows, and Escape closes.
 */
export function PhotoPreview({
  asset,
  hidden,
  onClose,
  onStep,
  onToggle,
  position,
  toast,
}: {
  /** The photo open, or none while closed. */
  asset: GalleryAsset | undefined;
  hidden: HiddenPhoto | undefined;
  onClose: () => void;
  onStep: (step: 1 | -1) => void;
  onToggle: (asset: GalleryAsset, hidden: boolean) => void;
  position: { at: number; of: number } | undefined;
  /** The page's toast, shown again here above the page. */
  toast: ToastMessage | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = asset !== undefined;

  // It opens on Close rather than the first button, the previous arrow.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The latest handlers, so the keys need not be listened for again as
  // the photo changes.
  const keys = useRef({ asset, hidden, onStep, onToggle });
  keys.current = { asset, hidden, onStep, onToggle };
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      // A held key repeats; hiding and showing should not flicker with it.
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
        return;
      }
      const current = keys.current;
      if (event.key === "ArrowLeft") current.onStep(-1);
      else if (event.key === "ArrowRight") current.onStep(1);
      else if (event.key.toLowerCase() === "h" && current.asset) {
        current.onToggle(current.asset, current.hidden !== undefined);
      } else return;
      event.preventDefault();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const date = asset ? formatPhotoDate(asset.date) : "";

  return (
    <dialog
      aria-label={asset ? `${kindLabels[asset.type]} ${date}` : "Photo"}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-night/96 p-0 text-paper outline-none backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      onClose={onClose}
      ref={dialogRef}
    >
      {asset ? (
        <div className="flex h-full flex-col lg:flex-row">
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 pt-[max(16px,env(safe-area-inset-top))] sm:p-8">
            {asset.type === "video" && asset.video ? (
              // biome-ignore lint/a11y/useMediaCaption: home videos of a cat, with no captions to give
              <video
                className="size-full object-contain"
                controls
                key={asset.id}
                playsInline
                poster={asset.large}
                src={asset.video.src}
              />
            ) : (
              // The grid's thumbnail, already loaded, shows beneath until
              // the large one arrives, letterboxed the same way.
              <img
                alt=""
                className={cx(
                  "size-full bg-contain bg-center bg-no-repeat object-contain transition-[filter,opacity] duration-300",
                  hidden && "opacity-60 grayscale",
                )}
                height={asset.height}
                key={asset.id}
                sizes="(min-width: 1024px) 70vw, 100vw"
                src={asset.large}
                srcSet={`${asset.small} 1280w, ${asset.large} 2400w`}
                style={{ backgroundImage: `url("${asset.small}")` }}
                width={asset.width}
              />
            )}
            <ControlButton
              className="absolute top-1/2 left-2 -translate-y-1/2 bg-night/40 max-sm:hidden"
              disabled={!position || position.at <= 0}
              label="Previous photo"
              onClick={() => onStep(-1)}
              shortcut="ArrowLeft"
            >
              <ChevronLeftIcon />
            </ControlButton>
            <ControlButton
              className="absolute top-1/2 right-2 -translate-y-1/2 bg-night/40 max-sm:hidden"
              disabled={!position || position.at >= position.of - 1}
              label="Next photo"
              onClick={() => onStep(1)}
              shortcut="ArrowRight"
            >
              <ChevronRightIcon />
            </ControlButton>
          </div>

          <aside className="flex shrink-0 flex-col gap-5 border-paper/8 px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] max-lg:border-t lg:w-[340px] lg:border-l lg:px-7 lg:py-7">
            <div className="flex items-center justify-between">
              <span className="label text-paper/40 tabular-nums">
                {position && position.at >= 0
                  ? `${numberFormatter.format(position.at + 1)} of ${numberFormatter.format(position.of)}`
                  : kindLabels[asset.type]}
              </span>
              <ControlButton
                className="-mr-2"
                label="Close"
                onClick={onClose}
                ref={closeRef}
                shortcut="Escape"
              >
                <CloseIcon />
              </ControlButton>
            </div>

            <div>
              <p className="font-serif text-[30px] leading-tight">
                {date || "Undated"}
              </p>
              <p className="label mt-2.5 flex items-center gap-2 text-paper/50">
                {asset.type === "live_photo" ? <LiveIcon size={13} /> : null}
                {kindLabels[asset.type]}
                {asset.time ? ` · ${formatClockTime(asset.time)}` : ""}
              </p>
            </div>

            <div
              className={cx(
                "flex items-start gap-3 rounded-[14px] px-4 py-3.5 text-[12px] leading-relaxed",
                hidden ? "bg-rose/10 text-paper" : "bg-paper/6 text-paper/75",
              )}
            >
              {hidden ? (
                <EyeOffIcon className="mt-px shrink-0 text-rose" size={16} />
              ) : (
                <EyeIcon className="mt-px shrink-0 text-paper/55" size={16} />
              )}
              <p>
                {hidden ? "Hidden from the gallery." : "In the gallery."}
                {hidden ? (
                  <span className="block text-paper/50">
                    {describeHidden(hidden)}
                  </span>
                ) : null}
              </p>
            </div>

            <button
              aria-keyshortcuts="H"
              className={cx(
                "flex w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-3 text-[12px] font-medium transition-[background-color,scale] duration-200 ease-soft active:scale-97",
                hidden
                  ? "bg-paper text-ink hover:bg-white"
                  : "border border-paper/20 text-paper hover:border-rose hover:bg-rose hover:text-ink",
                focusRing,
              )}
              onClick={() => onToggle(asset, hidden !== undefined)}
              type="button"
            >
              {hidden ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
              {hidden ? "Show in the gallery" : "Hide from the gallery"}
              <kbd className="ml-1 text-[10px] opacity-50 max-sm:hidden">H</kbd>
            </button>

            <p className="mt-auto font-mono text-[10px] break-all text-paper/30 select-all">
              {asset.id}
            </p>
          </aside>
        </div>
      ) : null}
      <Toast message={toast} />
    </dialog>
  );
}
