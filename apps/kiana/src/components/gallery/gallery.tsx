import type { PointerEvent } from "react";

import type { GalleryPhoto } from "../../data/photos";
import { cx } from "../../lib/class-names";
import { FramePicker } from "./frame-picker";
import { formatPhotoDate, transitionFor } from "./model";
import { PhotoLayer } from "./photo-layer";
import { useFramePreference } from "./use-frame-preference";
import { useFrameShortcuts } from "./use-frame-shortcuts";
import { useSlideshow } from "./use-slideshow";

export function Gallery({ photos }: { photos: ReadonlyArray<GalleryPhoto> }) {
  const [frame, setFrame] = useFramePreference();
  useFrameShortcuts(setFrame);
  const { isPaused, liveIndex, pause, position, resume, touchControlsVisible } =
    useSlideshow(photos.length);

  const previousIndex = (position.index - 1 + photos.length) % photos.length;
  const currentPhoto = photos[position.index];
  const previousPhoto = photos[previousIndex];
  const transition = transitionFor(position.index);
  const preloads = [1, 2]
    .map((offset) => photos[(liveIndex + offset) % photos.length])
    .filter(
      (photo, index, upcoming) =>
        photo.id !== photos[liveIndex].id &&
        upcoming.findIndex((candidate) => candidate.id === photo.id) === index,
    );
  const mat = frame === "mat";

  const toggleOnTap = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    if ((event.target as HTMLElement).closest("button")) return;
    if (isPaused) resume();
    else pause();
  };

  return (
    <>
      {preloads.map((photo) => (
        <link as="image" href={photo.large} key={photo.id} rel="preload" />
      ))}
      <main
        aria-label="Kiana photo gallery"
        className="relative isolate h-dvh w-screen cursor-default overflow-hidden bg-[#17120f] text-[#f6f0e6] select-none"
        onPointerDown={toggleOnTap}
      >
        <PhotoLayer
          direction="exit"
          frame={frame}
          key={`previous-${position.index}`}
          phase={position.phase}
          photo={previousPhoto}
          transition={transition}
        />
        <PhotoLayer
          direction="enter"
          frame={frame}
          key={`current-${position.index}`}
          phase={position.phase}
          photo={currentPhoto}
          transition={transition}
        />

        <p
          aria-live="polite"
          className={cx(
            "pointer-events-none absolute right-0 bottom-[43px] left-0 z-5 m-0 text-center text-[10px] leading-none font-light tracking-[.34em] indent-[.34em] transition-colors duration-250 max-sm:bottom-[calc(47px+env(safe-area-inset-bottom))] max-sm:text-[9px] max-sm:tracking-[.28em] max-sm:indent-[.28em]",
            mat ? "text-[rgba(23,18,15,.62)]" : "text-[rgba(246,240,230,.48)]",
          )}
        >
          {formatPhotoDate(currentPhoto.date)}
        </p>

        <FramePicker
          frame={frame}
          onPick={setFrame}
          touchVisible={touchControlsVisible}
        />

        <div
          aria-hidden="true"
          className={cx(
            "absolute right-0 bottom-0 left-0 z-8 h-0.5 overflow-hidden",
            mat ? "bg-[rgba(23,18,15,.1)]" : "bg-[rgba(246,240,230,.1)]",
          )}
        >
          <div
            className={cx(
              "h-full w-full origin-left animate-[gallery-progress_10s_linear_both] will-change-transform",
              mat ? "bg-[rgba(23,18,15,.36)]" : "bg-[#a89e92]",
            )}
            key={`${position.index}-${isPaused ? "paused" : "live"}`}
            style={{
              animationDelay: `${-position.phase}ms`,
              animationPlayState: isPaused ? "paused" : "running",
            }}
          />
        </div>
      </main>
    </>
  );
}
