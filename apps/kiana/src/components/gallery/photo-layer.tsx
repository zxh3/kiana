import type { CSSProperties } from "react";
import type { GalleryPhoto } from "../../data/photos";
import { cx } from "../../lib/class-names";
import {
  type Frame,
  formatPhotoDate,
  TRANSITION_DURATION,
  type Transition,
} from "./model";

type Direction = "enter" | "exit";

const layerClass =
  "absolute inset-0 z-1 overflow-hidden backface-hidden transition-[opacity,transform,filter] duration-[1600ms] ease-[cubic-bezier(.4,0,.2,1)] will-change-[transform,opacity] motion-reduce:transition-none";

const transitionClasses: Record<Transition, Record<Direction, string>> = {
  fade: {
    enter: "z-2 opacity-100 starting:opacity-0",
    exit: "opacity-0 starting:opacity-100",
  },
  push: {
    enter:
      "z-2 translate-x-0 opacity-100 starting:translate-x-[7%] starting:opacity-0",
    exit: "-translate-x-[5%] opacity-0 starting:translate-x-0 starting:opacity-100",
  },
  zoom: {
    enter: "z-2 scale-100 opacity-100 starting:scale-110 starting:opacity-0",
    exit: "scale-105 opacity-0 starting:scale-100 starting:opacity-100",
  },
  blur: {
    enter:
      "z-2 blur-0 saturate-100 opacity-100 starting:blur-[26px] starting:saturate-[.55] starting:opacity-0",
    exit: "blur-[14px] opacity-0 starting:blur-0 starting:opacity-100",
  },
  drift: {
    enter:
      "z-2 translate-y-0 scale-100 opacity-100 starting:translate-y-[5%] starting:scale-105 starting:opacity-0",
    exit: "-translate-y-[3%] opacity-0 starting:translate-y-0 starting:opacity-100",
  },
};

function Picture({
  photo,
  current,
  className,
}: {
  photo: GalleryPhoto;
  current: boolean;
  className: string;
}) {
  return (
    <img
      alt={current ? `Kiana — ${formatPhotoDate(photo.date)}` : ""}
      className={className}
      decoding="async"
      draggable={false}
      fetchPriority={current ? "high" : "auto"}
      height={photo.height}
      loading={current ? "eager" : "lazy"}
      sizes="100vw"
      src={photo.large}
      srcSet={`${photo.small} 1280w, ${photo.large} 2400w`}
      width={photo.width}
    />
  );
}

function PhotoBackdrop({ photo }: { photo: GalleryPhoto }) {
  return (
    <>
      <div
        className="absolute -inset-[12%] scale-110 bg-cover bg-center blur-[52px] brightness-[.62] saturate-150 will-change-transform"
        style={{ backgroundImage: `url("${photo.small}")` }}
      />
      <div className="absolute inset-0 bg-[rgba(23,18,15,.3)]" />
    </>
  );
}

export function PhotoLayer({
  photo,
  frame,
  transition,
  direction,
  phase,
}: {
  photo: GalleryPhoto;
  frame: Frame;
  transition: Transition;
  direction: Direction;
  phase: number;
}) {
  const current = direction === "enter";
  const className = cx(
    layerClass,
    transitionClasses[frame === "fill" ? "fade" : transition][direction],
  );
  const style: CSSProperties = {
    transitionDelay: `${-Math.min(phase, TRANSITION_DURATION)}ms`,
  };

  if (frame !== "mat") {
    return (
      <div aria-hidden={!current} className={className} style={style}>
        <PhotoBackdrop photo={photo} />
        <div className="absolute inset-0 grid place-items-center">
          <Picture
            className={cx(
              "block h-auto w-auto object-contain",
              frame === "fill"
                ? "max-h-[100dvh] max-w-[100vw]"
                : "max-h-[76dvh] max-w-[min(82vw,1060px)] shadow-[0_46px_100px_-40px_rgba(0,0,0,.95)] max-sm:max-h-[70dvh] max-sm:max-w-[90vw]",
            )}
            current={current}
            photo={photo}
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
        <Picture
          className="block h-auto w-auto max-h-[calc(78dvh-clamp(24px,3.6vw,52px))] max-w-[calc(84vw-clamp(24px,3.6vw,52px))] object-contain max-sm:max-h-[calc(72dvh-24px)] max-sm:max-w-[calc(90vw-24px)]"
          current={current}
          photo={photo}
        />
      </div>
    </div>
  );
}
