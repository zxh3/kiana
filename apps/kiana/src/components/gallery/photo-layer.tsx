import { useEffect, useRef, useState } from "react";

import type { GalleryAsset } from "../../data/photos";
import { cx } from "../../lib/class-names";
import { frameStyles } from "./frame-styles";
import { type LayerDirection, mediaTransition } from "./media-transition";
import {
  type Frame,
  formatPhotoDate,
  TRANSITION_DURATION,
  type Transition,
} from "./model";
import { PhotoBackdrop } from "./photo-backdrop";
import { useMediaVolume } from "./use-media-volume";

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
  paused,
  volume,
}: {
  asset: GalleryAsset;
  className: string;
  current: boolean;
  muted: boolean;
  paused: boolean;
  volume: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useMediaVolume(videoRef, volume);
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
    if (paused) {
      element.pause();
      return;
    }
    // A Live Photo plays once per slide; resuming continues a paused clip.
    if (element.ended) return;

    const delay = element.currentTime > 0 ? 0 : LIVE_PHOTO_DELAY;
    const timeout = window.setTimeout(() => {
      void element.play().catch(() => undefined);
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [current, livePhoto, paused]);

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
  paused,
  volume,
}: {
  asset: GalleryAsset;
  frame: Frame;
  transition: Transition;
  direction: LayerDirection;
  muted: boolean;
  paused: boolean;
  volume: number;
}) {
  const current = direction === "enter";
  const presentation = mediaTransition(transition, direction);
  const mediaProps = { asset, current, muted, paused, volume };

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
                ? frameStyles.media.fill
                : frameStyles.media.backdrop,
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
        "grid place-items-center",
        frameStyles.wall,
      )}
      style={presentation.style}
    >
      <div className={frameStyles.card}>
        <PhotoContent
          {...mediaProps}
          className={cx(
            "block h-auto w-auto object-contain",
            frameStyles.media.mat,
          )}
        />
      </div>
    </div>
  );
}
