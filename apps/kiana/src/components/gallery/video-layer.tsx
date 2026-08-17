import { useCallback, useEffect, useRef, useState } from "react";

import type { GalleryAsset } from "../../data/photos";
import { cx } from "../../lib/class-names";
import { type LayerDirection, mediaTransition } from "./media-transition";
import type { Frame, Transition } from "./model";
import { PhotoBackdrop } from "./photo-backdrop";

const VIDEO_PROMPT_DELAY = 2_000;
const VIDEO_RECOVERY_TIMEOUT = 10_000;

type VideoPlaybackState = "loading" | "playing" | "needs-action";

export function VideoLayer({
  asset,
  direction,
  frame,
  muted,
  onEnded,
  onProgress,
  transition,
}: {
  asset?: GalleryAsset;
  direction: LayerDirection;
  frame: Frame;
  muted: boolean;
  onEnded: () => void;
  onProgress: (progress: number) => void;
  transition: Transition;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentRef = useRef(direction === "enter");
  const finished = useRef(false);
  const playAttempt = useRef(0);
  const promptTimer = useRef<number>(undefined);
  const recoveryTimer = useRef<number>(undefined);
  const [playbackState, setPlaybackState] =
    useState<VideoPlaybackState>("loading");
  const video = asset?.video;
  const current = direction === "enter";
  const mat = frame === "mat";
  currentRef.current = current;

  const clearRecoveryTimers = useCallback(() => {
    window.clearTimeout(promptTimer.current);
    window.clearTimeout(recoveryTimer.current);
    promptTimer.current = undefined;
    recoveryTimer.current = undefined;
  }, []);

  const finishVideo = useCallback(() => {
    if (!currentRef.current || finished.current) return;
    finished.current = true;
    playAttempt.current += 1;
    clearRecoveryTimers();
    videoRef.current?.pause();
    onEnded();
  }, [clearRecoveryTimers, onEnded]);

  const waitForPlayback = useCallback(() => {
    if (!currentRef.current) return;
    if (promptTimer.current === undefined) {
      promptTimer.current = window.setTimeout(() => {
        promptTimer.current = undefined;
        if (currentRef.current) setPlaybackState("needs-action");
      }, VIDEO_PROMPT_DELAY);
    }
    if (recoveryTimer.current === undefined) {
      recoveryTimer.current = window.setTimeout(
        finishVideo,
        VIDEO_RECOVERY_TIMEOUT,
      );
    }
  }, [finishVideo]);

  const playVideo = useCallback(async () => {
    const element = videoRef.current;
    if (!element || !video || !currentRef.current) return;
    const attempt = ++playAttempt.current;
    setPlaybackState("loading");
    waitForPlayback();
    try {
      await element.play();
    } catch {
      if (
        attempt === playAttempt.current &&
        element === videoRef.current &&
        currentRef.current
      ) {
        setPlaybackState("needs-action");
      }
    }
  }, [video, waitForPlayback]);

  const retryVideo = () => {
    clearRecoveryTimers();
    videoRef.current?.pause();
    void playVideo();
  };

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !video) return;
    clearRecoveryTimers();
    finished.current = false;
    playAttempt.current += 1;
    if (!current) {
      element.pause();
      return;
    }

    onProgress(0);
    setPlaybackState("loading");
    void playVideo();
    return clearRecoveryTimers;
  }, [clearRecoveryTimers, current, onProgress, playVideo, video]);

  useEffect(() => {
    const element = videoRef.current;
    if (!current || !video || !element) return;
    let frameRequest = 0;
    const update = () => {
      const duration = Number.isFinite(element.duration)
        ? element.duration
        : (video.durationMs ?? 0) / 1000;
      onProgress(
        duration > 0 ? Math.min(1, element.currentTime / duration) : 0,
      );
      frameRequest = window.requestAnimationFrame(update);
    };
    frameRequest = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frameRequest);
  }, [current, onProgress, video]);

  const presentation = mediaTransition(transition, direction);

  return (
    <div
      aria-hidden={!current}
      className={cx(presentation.className, mat && "bg-[#e9e2d6]")}
      style={presentation.style}
    >
      {asset ? (
        <PhotoBackdrop asset={asset} hidden={mat} key="backdrop" />
      ) : null}
      <div className="absolute inset-0 grid place-items-center" key="media">
        <div
          className={cx(
            "relative grid place-items-center",
            mat &&
              "flex max-h-[78dvh] max-w-[84vw] bg-[#f6f0e6] p-[clamp(12px,1.8vw,26px)] shadow-[0_1px_2px_rgba(23,18,15,.18),0_26px_60px_-26px_rgba(23,18,15,.5)] max-sm:max-h-[72dvh] max-sm:max-w-[90vw] max-sm:p-3",
          )}
        >
          <video
            aria-label={current ? "Kiana video" : undefined}
            autoPlay={current}
            className={cx(
              "block h-auto w-auto object-contain",
              mat
                ? "max-h-[calc(78dvh-clamp(24px,3.6vw,52px))] max-w-[calc(84vw-clamp(24px,3.6vw,52px))] max-sm:max-h-[calc(72dvh-24px)] max-sm:max-w-[calc(90vw-24px)]"
                : frame === "fill"
                  ? "max-h-[100dvh] max-w-[100vw]"
                  : "max-h-[76dvh] max-w-[min(82vw,1060px)] shadow-[0_46px_100px_-40px_rgba(0,0,0,.95)] max-sm:max-h-[70dvh] max-sm:max-w-[90vw]",
            )}
            disablePictureInPicture
            height={video?.height}
            muted={muted}
            onEnded={finishVideo}
            onError={finishVideo}
            onPlaying={() => {
              if (!currentRef.current) return;
              clearRecoveryTimers();
              setPlaybackState("playing");
            }}
            onWaiting={waitForPlayback}
            playsInline
            poster={asset?.large}
            preload={current ? "auto" : "metadata"}
            ref={videoRef}
            src={video?.src}
            width={video?.width}
          />
          {current && playbackState === "needs-action" ? (
            <button
              className="absolute inset-0 m-auto h-fit w-fit touch-manipulation cursor-pointer rounded-full border border-white/20 bg-black/55 px-5 py-3 text-[10px] font-medium tracking-[.2em] text-white uppercase shadow-lg backdrop-blur-md transition-colors hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              onClick={retryVideo}
              type="button"
            >
              Tap to play
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
