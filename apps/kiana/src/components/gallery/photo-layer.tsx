import { type CSSProperties, useEffect, useRef } from "react";

import type { GalleryAsset } from "../../data/photos";
import { cx } from "../../lib/class-names";
import {
  type Frame,
  formatPhotoDate,
  TRANSITION_DURATION,
  type Transition,
} from "./model";

type Direction = "enter" | "exit";

const layerClass =
  "absolute inset-0 z-1 overflow-hidden backface-hidden transition-[opacity,transform,filter] ease-[cubic-bezier(.4,0,.2,1)] will-change-[transform,opacity] motion-reduce:transition-none";

const transitionClasses: Record<Transition, Record<Direction, string>> = {
  fade: {
    enter: "z-2 opacity-100 starting:opacity-0",
    exit: "opacity-0 starting:opacity-100",
  },
  float: {
    enter:
      "z-2 translate-y-0 scale-100 opacity-100 starting:translate-y-[2%] starting:scale-[1.02] starting:opacity-0",
    exit: "-translate-y-[1%] scale-[1.01] opacity-0 starting:translate-y-0 starting:scale-100 starting:opacity-100",
  },
  settle: {
    enter: "z-2 opacity-100 starting:opacity-0",
    exit: "opacity-0 starting:opacity-100",
  },
};

const transitionTimings: Record<
  Transition,
  Record<Direction, { duration: number; start: number }>
> = {
  fade: {
    enter: { duration: TRANSITION_DURATION, start: 0 },
    exit: { duration: TRANSITION_DURATION, start: 0 },
  },
  float: {
    enter: { duration: TRANSITION_DURATION, start: 0 },
    exit: { duration: TRANSITION_DURATION, start: 0 },
  },
  settle: {
    enter: { duration: 900, start: 550 },
    exit: { duration: 550, start: 0 },
  },
};

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

function MovingPicture({
  asset,
  className,
  current,
  muted,
  onEnded,
  onProgress,
}: {
  asset: GalleryAsset;
  className: string;
  current: boolean;
  muted: boolean;
  onEnded: () => void;
  onProgress: (progress: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const video = asset.video;

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (!current) {
      element.pause();
      return;
    }
    void element.play().catch(() => undefined);
  }, [current]);

  useEffect(() => {
    const element = videoRef.current;
    if (!current || asset.type !== "video" || !element) return;
    let frame = 0;
    const update = () => {
      const duration = Number.isFinite(element.duration)
        ? element.duration
        : (video?.durationMs ?? 0) / 1000;
      onProgress(
        duration > 0 ? Math.min(1, element.currentTime / duration) : 0,
      );
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [asset.type, current, onProgress, video?.durationMs]);

  if (!video) {
    return <Picture asset={asset} className={className} current={current} />;
  }

  return (
    <video
      aria-label={current ? "Kiana video" : undefined}
      autoPlay={current}
      className={className}
      disablePictureInPicture
      height={video.height}
      loop={asset.type === "live_photo"}
      muted={muted}
      onEnded={() => {
        if (current && asset.type === "video") onEnded();
      }}
      onError={() => {
        if (current && asset.type === "video") onEnded();
      }}
      playsInline
      poster={asset.large}
      preload={current ? "auto" : "metadata"}
      ref={videoRef}
      src={video.src}
      width={video.width}
    />
  );
}

function PhotoBackdrop({ asset }: { asset: GalleryAsset }) {
  return (
    <>
      <div
        className="absolute -inset-[12%] scale-110 bg-cover bg-center blur-[52px] brightness-[.62] saturate-150 will-change-transform"
        style={{ backgroundImage: `url("${asset.small}")` }}
      />
      <div className="absolute inset-0 bg-[rgba(23,18,15,.3)]" />
    </>
  );
}

export function PhotoLayer({
  asset,
  frame,
  transition,
  direction,
  muted,
  onVideoEnded,
  onVideoProgress,
}: {
  asset: GalleryAsset;
  frame: Frame;
  transition: Transition;
  direction: Direction;
  muted: boolean;
  onVideoEnded: () => void;
  onVideoProgress: (progress: number) => void;
}) {
  const current = direction === "enter";
  const className = cx(layerClass, transitionClasses[transition][direction]);
  const timing = transitionTimings[transition][direction];
  const style: CSSProperties = {
    transitionDelay: `${timing.start}ms`,
    transitionDuration: `${timing.duration}ms`,
  };
  const mediaProps = {
    asset,
    current,
    muted,
    onEnded: onVideoEnded,
    onProgress: onVideoProgress,
  };

  if (frame !== "mat") {
    return (
      <div aria-hidden={!current} className={className} style={style}>
        <PhotoBackdrop asset={asset} />
        <div className="absolute inset-0 grid place-items-center">
          <MovingPicture
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
      className={cx(className, "grid place-items-center bg-[#e9e2d6]")}
      style={style}
    >
      <div className="flex max-h-[78dvh] max-w-[84vw] bg-[#f6f0e6] p-[clamp(12px,1.8vw,26px)] shadow-[0_1px_2px_rgba(23,18,15,.18),0_26px_60px_-26px_rgba(23,18,15,.5)] max-sm:max-h-[72dvh] max-sm:max-w-[90vw] max-sm:p-3">
        <MovingPicture
          {...mediaProps}
          className="block h-auto w-auto max-h-[calc(78dvh-clamp(24px,3.6vw,52px))] max-w-[calc(84vw-clamp(24px,3.6vw,52px))] object-contain max-sm:max-h-[calc(72dvh-24px)] max-sm:max-w-[calc(90vw-24px)]"
        />
      </div>
    </div>
  );
}
