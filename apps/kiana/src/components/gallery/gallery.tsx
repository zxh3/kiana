import { useCallback, useState } from "react";

import type { GalleryAsset } from "../../data/photos";
import { cx } from "../../lib/class-names";
import { AudioControl } from "./audio-control";
import { FramePicker } from "./frame-picker";
import { formatPhotoDate, transitionFor } from "./model";
import { PhotoLayer } from "./photo-layer";
import { useFramePreference } from "./use-frame-preference";
import { useFrameShortcuts } from "./use-frame-shortcuts";
import { useSlideshow } from "./use-slideshow";

export function Gallery({ photos }: { photos: ReadonlyArray<GalleryAsset> }) {
  const [frame, setFrame] = useFramePreference();
  const [muted, setMuted] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  useFrameShortcuts(setFrame);
  const { advance, index, previousIndex, upcomingIndexes } =
    useSlideshow(photos);

  const currentPhoto = photos[index];
  const previousPhoto = photos[previousIndex];
  const transition = transitionFor(frame);
  const preloads = upcomingIndexes
    .map((upcomingIndex) => photos[upcomingIndex])
    .filter(
      (photo, index, upcoming) =>
        photo.id !== currentPhoto.id &&
        upcoming.findIndex((candidate) => candidate.id === photo.id) === index,
    );
  const mat = frame === "mat";
  const regularVideo = currentPhoto.type === "video";
  const updateVideoProgress = useCallback((progress: number) => {
    setVideoProgress(progress);
  }, []);

  return (
    <>
      {preloads.map((photo) => (
        <link as="image" href={photo.large} key={photo.id} rel="preload" />
      ))}
      <main
        aria-label="Kiana photo gallery"
        className={cx(
          "relative isolate h-dvh w-screen cursor-default overflow-hidden text-[#f6f0e6] select-none transition-colors duration-500",
          mat ? "bg-[#e9e2d6]" : "bg-[#17120f]",
        )}
      >
        <PhotoLayer
          asset={previousPhoto}
          direction="exit"
          frame={frame}
          key={previousPhoto.id}
          muted={muted}
          onVideoEnded={advance}
          onVideoProgress={updateVideoProgress}
          transition={transition}
        />
        <PhotoLayer
          asset={currentPhoto}
          direction="enter"
          frame={frame}
          key={currentPhoto.id}
          muted={muted}
          onVideoEnded={advance}
          onVideoProgress={updateVideoProgress}
          transition={transition}
        />

        <AudioControl
          mat={mat}
          muted={muted}
          onToggle={() => setMuted((value) => !value)}
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

        <FramePicker frame={frame} onPick={setFrame} />

        <div
          aria-hidden="true"
          className={cx(
            "absolute right-0 bottom-0 left-0 z-8 h-0.5 overflow-hidden",
            mat ? "bg-[rgba(23,18,15,.1)]" : "bg-[rgba(246,240,230,.1)]",
          )}
        >
          <div
            className={cx(
              "h-full w-full origin-left will-change-transform",
              !regularVideo && "animate-[gallery-progress_10s_linear_both]",
              mat ? "bg-[rgba(23,18,15,.36)]" : "bg-[#a89e92]",
            )}
            key={index}
            style={
              regularVideo
                ? { transform: `scaleX(${videoProgress})` }
                : undefined
            }
          />
        </div>
      </main>
    </>
  );
}
