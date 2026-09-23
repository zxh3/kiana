import { useCallback, useEffect, useRef, useState } from "react";

import { backgroundTrack } from "./music-track";
import { useStoredState } from "./use-stored-state";
import { loadYouTubeApi, PlayerState, type YouTubePlayer } from "./youtube-api";

/**
 * idle: no player. loading: fetching the API or buffering the first play.
 * blocked: the browser refused to start sound without a tap on the video.
 */
export type MusicStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "blocked"
  | "error";

const VOLUME_KEY = "kiana.music-volume";
const DEFAULT_VOLUME = 60;
const BLOCKED_AFTER = 2_500;

export function parseVolume(raw: string | null) {
  const value = Number(raw);
  return raw !== null && raw !== "" && value >= 0 && value <= 100
    ? Math.round(value)
    : DEFAULT_VOLUME;
}

function applyVolume(player: YouTubePlayer, volume: number) {
  if (volume === 0) {
    player.mute();
    return;
  }
  player.unMute();
  player.setVolume(volume);
}

/**
 * Background music through YouTube's embedded player. YouTube's policies
 * require the player to stay visible while it plays, so the player lives in
 * a card the page shows for as long as music is on.
 */
export function useMusic() {
  const [status, setStatus] = useState<MusicStatus>("idle");
  const [volume, saveVolume] = useStoredState(VOLUME_KEY, parseVolume);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const blockedTimer = useRef<number>(undefined);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const destroy = useCallback(() => {
    window.clearTimeout(blockedTimer.current);
    playerRef.current?.destroy();
    playerRef.current = null;
    hostRef.current?.replaceChildren();
  }, []);

  // Create the player once the card, and so its host element, is on screen.
  useEffect(() => {
    if (status !== "loading" || playerRef.current) return;
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const { videoId } = backgroundTrack;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || playerRef.current) return;
        // The API replaces its target, so give it a node React does not own.
        const target = document.createElement("div");
        host.replaceChildren(target);
        playerRef.current = new YT.Player(target, {
          videoId,
          width: "100%",
          height: "100%",
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            loop: 1,
            playlist: videoId,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: ({ target: player }) => {
              applyVolume(player, volumeRef.current);
              player.playVideo();
              blockedTimer.current = window.setTimeout(() => {
                const state = player.getPlayerState();
                if (
                  state !== PlayerState.playing &&
                  state !== PlayerState.buffering
                ) {
                  setStatus("blocked");
                }
              }, BLOCKED_AFTER);
            },
            onStateChange: ({ target: player, data }) => {
              if (data === PlayerState.playing) {
                window.clearTimeout(blockedTimer.current);
                setStatus("playing");
              } else if (data === PlayerState.paused) {
                setStatus("paused");
              } else if (data === PlayerState.ended) {
                // `loop` covers this; restarting here is a safety net.
                player.seekTo(0, true);
                player.playVideo();
              }
            },
            onError: () => {
              window.clearTimeout(blockedTimer.current);
              setStatus("error");
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => destroy, [destroy]);

  const start = useCallback(() => {
    if (status === "error") destroy();
    const player = status === "error" ? null : playerRef.current;
    if (player) player.playVideo();
    else setStatus("loading");
  }, [destroy, status]);

  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);

  const toggle = useCallback(() => {
    if (status === "playing") pause();
    else start();
  }, [pause, start, status]);

  const stop = useCallback(() => {
    destroy();
    setStatus("idle");
  }, [destroy]);

  const setVolume = useCallback(
    (next: number) => {
      saveVolume(next);
      if (playerRef.current) applyVolume(playerRef.current, next);
    },
    [saveVolume],
  );

  // Warm the API on hover so the first click starts sound sooner.
  const preload = useCallback(() => {
    void loadYouTubeApi().catch(() => undefined);
  }, []);

  return {
    hostRef,
    pause,
    preload,
    setVolume,
    start,
    status,
    stop,
    toggle,
    volume,
  };
}

export type Music = ReturnType<typeof useMusic>;
