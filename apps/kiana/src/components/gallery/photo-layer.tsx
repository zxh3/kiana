import { useEffect, useRef, useState } from "react";

import type { GalleryAsset } from "../../data/photos";
import { cx } from "../../lib/class-names";
import { type LayerDirection, mediaTransition } from "./media-transition";
import {
  type Frame,
  formatPhotoDate,
  TRANSITION_DURATION,
  type Transition,
} from "./model";
import { PhotoBackdrop } from "./photo-backdrop";

const LIVE_PHOTO_DELAY = TRANSITION_DURATION;

function Picture({
  asset,
  current,
  className,
}: {
  asset: GalleryAsset;
  current: boolean;
  className: string;
}) {
  const date = formatPhotoDate(asset.date);
  return (
    <img
      alt={current ? (date ? `Kiana — ${date}` : "Kiana") : ""}
      className={className}
      decoding="async"
      draggable={false}
      fetchPriority={current ? "high" : "auto"}
      height={asset.height}
      loading={current ? "eager" : "lazy"}
      sizes="100vw"
      src={asset.large}
      srcSet={`${asset.small} 1280w, ${asset.large} 2400w`}
      width={asset.width}
    />
  );
}

function PhotoContent({
  asset,
  className,
  current,
  muted,
}: {
  asset: GalleryAsset;
  className: string;
  current: boolean;
  muted: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [livePhotoPlaying, setLivePhotoPlaying] = useState(false);
  const video = asset.video;
  const livePhoto = asset.type === "live_photo";

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !livePhoto) return;
    if (!current) {
      element.pause();
      element.currentTime = 0;
      setLivePhotoPlaying(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      void element.play().catch(() => undefined);
    }, LIVE_PHOTO_DELAY);
    return () => window.clearTimeout(timeout);
  }, [current, livePhoto]);

  if (!livePhoto || !video) {
    return <Picture asset={asset} className={className} current={current} />;
  }

  return (
    <div className="relative grid place-items-center">
      <Picture asset={asset} className={className} current={current} />
      <video
        aria-hidden="true"
        className={cx(
          "absolute inset-0 size-full object-contain transition-opacity duration-500 ease-out motion-reduce:transition-none",
          livePhotoPlaying ? "opacity-100" : "opacity-0",
        )}
        disablePictureInPicture
        height={video.height}
        muted={muted}
        onEnded={() => setLivePhotoPlaying(false)}
        onError={() => setLivePhotoPlaying(false)}
        onPlay={() => setLivePhotoPlaying(true)}
        playsInline
        poster={asset.large}
        preload={current ? "auto" : "metadata"}
        ref={videoRef}
        src={video.src}
        tabIndex={-1}
        width={video.width}
      />
    </div>
  );
}

export function PhotoLayer({
  asset,
  frame,
  transition,
  direction,
  muted,
}: {
  asset: GalleryAsset;
  frame: Frame;
  transition: Transition;
  direction: LayerDirection;
  muted: boolean;
}) {
  const current = direction === "enter";
  const presentation = mediaTransition(transition, direction);
  const mediaProps = { asset, current, muted };

  if (frame !== "mat") {
    return (
      <div
        aria-hidden={!current}
        className={presentation.className}
        style={presentation.style}
      >
        <PhotoBackdrop asset={asset} />
        <div className="absolute inset-0 grid place-items-center">
          <PhotoContent
            {...mediaProps}
            className={cx(
              "block h-auto w-auto object-contain",
              frame === "fill"
                ? "max-h-[100dvh] max-w-[100vw]"
                : "max-h-[76dvh] max-w-[min(82vw,1060px)] shadow-[0_46px_100px_-40px_rgba(0,0,0,.95)] max-sm:max-h-[70dvh] max-sm:max-w-[90vw]",
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden={!current}
      className={cx(
        presentation.className,
        "grid place-items-center bg-[#e9e2d6]",
      )}
      style={presentation.style}
    >
      <div className="flex max-h-[78dvh] max-w-[84vw] bg-[#f6f0e6] p-[clamp(12px,1.8vw,26px)] shadow-[0_1px_2px_rgba(23,18,15,.18),0_26px_60px_-26px_rgba(23,18,15,.5)] max-sm:max-h-[72dvh] max-sm:max-w-[90vw] max-sm:p-3">
        <PhotoContent
          {...mediaProps}
          className="block h-auto w-auto max-h-[calc(78dvh-clamp(24px,3.6vw,52px))] max-w-[calc(84vw-clamp(24px,3.6vw,52px))] object-contain max-sm:max-h-[calc(72dvh-24px)] max-sm:max-w-[calc(90vw-24px)]"
        />
      </div>
    </div>
  );
}
