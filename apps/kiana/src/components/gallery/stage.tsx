import { useRef } from "react";

import type { GalleryAsset } from "../../data/photos";
import { type Frame, transitionFor } from "./model";
import { PhotoLayer } from "./photo-layer";
import { VideoLayer } from "./video-layer";

/**
 * The media layers. One persistent video element is reused across regular
 * videos so a browser that allowed sound for it keeps allowing it.
 */
export function Stage({
  assets,
  frame,
  index,
  muted,
  onVideoEnded,
  onVideoProgress,
  paused,
  previousIndex,
}: {
  assets: ReadonlyArray<GalleryAsset>;
  frame: Frame;
  index: number;
  muted: boolean;
  onVideoEnded: () => void;
  onVideoProgress: (progress: number) => void;
  paused: boolean;
  previousIndex: number | null;
}) {
  const current = assets[index];
  const previous =
    previousIndex !== null && previousIndex !== index
      ? assets[previousIndex]
      : undefined;
  const transition = transitionFor(frame);
  const regularVideo = current.type === "video";
  const previousVideo = previous?.type === "video";
  const retainedVideo = useRef<GalleryAsset | undefined>(undefined);
  if (regularVideo) retainedVideo.current = current;
  else if (previousVideo) retainedVideo.current = previous;
  const videoDirection = regularVideo
    ? "enter"
    : previousVideo
      ? "exit"
      : "hidden";

  return (
    <>
      {previous && (!previousVideo || regularVideo) ? (
        <PhotoLayer
          asset={previous}
          direction="exit"
          frame={frame}
          key={previous.id}
          muted={muted}
          paused={paused}
          transition={transition}
        />
      ) : null}
      <VideoLayer
        asset={retainedVideo.current}
        direction={videoDirection}
        frame={frame}
        key="persistent-video"
        muted={muted}
        onEnded={onVideoEnded}
        onProgress={onVideoProgress}
        paused={paused}
        transition={transition}
      />
      {!regularVideo ? (
        <PhotoLayer
          asset={current}
          direction="enter"
          frame={frame}
          key={current.id}
          muted={muted}
          paused={paused}
          transition={transition}
        />
      ) : null}
    </>
  );
}
