import { useCallback, useEffect, useRef, useState } from "react";
import { useStoredState } from "../use-stored-state";
import {
  nextPlayMode,
  nextTrackIndex,
  type PlayMode,
  parsePlayMode,
  previousTrackIndex,
} from "./music-queue";
import { playlist } from "./music-track";
import { loadYouTubeApi, PlayerState, type YouTubePlayer } from "./youtube-api";

/**
 * idle: no player. loading: fetching the API or buffering the first play.
 * blocked: the browser refused to start sound without a tap on the video.
 * error: no track in the playlist would play here.
 */
export type MusicStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "blocked"
  | "error";

const VOLUME_KEY = "kiana.music-volume";
const TRACK_KEY = "kiana.music-track";
const MODE_KEY = "kiana.music-mode";
const DEFAULT_VOLUME = 60;
const BLOCKED_AFTER = 2_500;
/** Past this many seconds, previous restarts the song instead. */
const RESTART_AFTER = 3;
const SHUFFLE_MEMORY = 50;

function parseVolume(raw: string | null) {
  const value = Number(raw);
  return raw !== null && raw !== "" && value >= 0 && value <= 100
    ? Math.round(value)
    : DEFAULT_VOLUME;
}

/** The saved track is stored by video id, so reordering keeps the place. */
function parseTrackIndex(raw: string | null) {
  const index = playlist.findIndex(({ videoId }) => videoId === raw);
  return index >= 0 ? index : 0;
}

function serializeTrackIndex(index: number) {
  return playlist[index]?.videoId ?? "";
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
 * Background music through YouTube's embedded player, which lives in the
 * now-playing widget for as long as music is on. One player plays the whole
 * playlist; songs that YouTube refuses to embed are skipped.
 */
export function useMusic() {
  const [status, setStatus] = useState<MusicStatus>("idle");
  const [volume, saveVolume] = useStoredState(VOLUME_KEY, parseVolume);
  const [index, saveIndex] = useStoredState(
    TRACK_KEY,
    parseTrackIndex,
    serializeTrackIndex,
  );
  const [mode, saveMode] = useStoredState(MODE_KEY, parsePlayMode);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const blockedTimer = useRef<number>(undefined);
  const failures = useRef(0);
  const shuffleHistory = useRef<number[]>([]);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const indexRef = useRef(index);
  indexRef.current = index;
  const modeRef = useRef<PlayMode>(mode);
  modeRef.current = mode;

  const destroy = useCallback(() => {
    window.clearTimeout(blockedTimer.current);
    playerRef.current?.destroy();
    playerRef.current = null;
    hostRef.current?.replaceChildren();
  }, []);

  /** Switch to a track; the player keeps running, so sound never stops. */
  const load = useCallback(
    (next: number, remember = true) => {
      if (remember && modeRef.current === "shuffle") {
        shuffleHistory.current = [
          ...shuffleHistory.current,
          indexRef.current,
        ].slice(-SHUFFLE_MEMORY);
      }
      indexRef.current = next;
      saveIndex(next);
      const player = playerRef.current;
      if (player) player.loadVideoById(playlist[next].videoId);
      else setStatus("loading");
    },
    [saveIndex],
  );

  // Create the player once the widget, and so its host element, is on screen.
  useEffect(() => {
    if (status !== "loading" || playerRef.current) return;
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || playerRef.current) return;
        // The API replaces its target, so give it a node React does not own.
        const target = document.createElement("div");
        host.replaceChildren(target);
        playerRef.current = new YT.Player(target, {
          videoId: playlist[indexRef.current].videoId,
          width: "100%",
          height: "100%",
          // Not youtube-nocookie.com: privacy-enhanced mode ignores the
          // viewer's YouTube sign-in, which is what clears YouTube's
          // "confirm you're not a bot" check. The API loads only after a
          // click on Music, so the page sets no YouTube cookies before that.
          host: "https://www.youtube.com",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
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
                failures.current = 0;
                setStatus("playing");
              } else if (data === PlayerState.paused) {
                setStatus("paused");
              } else if (data === PlayerState.ended) {
                if (modeRef.current === "one") {
                  player.seekTo(0, true);
                  player.playVideo();
                } else {
                  load(
                    nextTrackIndex(
                      indexRef.current,
                      playlist.length,
                      modeRef.current,
                    ),
                  );
                }
              }
            },
            onError: () => {
              // One song refusing to embed skips ahead; every song failing
              // (YouTube's bot check, no network) stops with an explanation.
              failures.current += 1;
              if (failures.current >= playlist.length) {
                window.clearTimeout(blockedTimer.current);
                setStatus("error");
                return;
              }
              load((indexRef.current + 1) % playlist.length, false);
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
  }, [load, status]);

  useEffect(() => destroy, [destroy]);

  const start = useCallback(() => {
    if (status === "error") {
      destroy();
      failures.current = 0;
      setStatus("loading");
      return;
    }
    if (playerRef.current) playerRef.current.playVideo();
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

  const next = useCallback(() => {
    load(nextTrackIndex(indexRef.current, playlist.length, modeRef.current));
  }, [load]);

  const previous = useCallback(() => {
    const player = playerRef.current;
    if (player && (player.getCurrentTime?.() ?? 0) > RESTART_AFTER) {
      player.seekTo(0, true);
      return;
    }
    const remembered =
      modeRef.current === "shuffle" ? shuffleHistory.current.pop() : undefined;
    load(
      remembered ?? previousTrackIndex(indexRef.current, playlist.length),
      false,
    );
  }, [load]);

  /** Pick a song from the playlist; picking the current one resumes it. */
  const playTrack = useCallback(
    (target: number) => {
      if (target === indexRef.current && playerRef.current) {
        playerRef.current.playVideo();
        return;
      }
      load(target);
    },
    [load],
  );

  const setMode = useCallback(
    (next: PlayMode) => {
      shuffleHistory.current = [];
      modeRef.current = next;
      saveMode(next);
    },
    [saveMode],
  );

  const cycleMode = useCallback(() => {
    setMode(nextPlayMode(modeRef.current));
  }, [setMode]);

  const setVolume = useCallback(
    (value: number) => {
      saveVolume(value);
      if (playerRef.current) applyVolume(playerRef.current, value);
    },
    [saveVolume],
  );

  /** Read on demand so time updates never re-render the whole gallery. */
  const readProgress = useCallback(() => {
    const player = playerRef.current;
    return {
      current: player?.getCurrentTime?.() ?? 0,
      duration: player?.getDuration?.() ?? 0,
    };
  }, []);

  const seek = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
  }, []);

  // Warm the API on hover so the first click starts sound sooner.
  const preload = useCallback(() => {
    void loadYouTubeApi().catch(() => undefined);
  }, []);

  return {
    cycleMode,
    hostRef,
    index,
    mode,
    next,
    pause,
    playTrack,
    playlist,
    preload,
    previous,
    readProgress,
    seek,
    setMode,
    setVolume,
    start,
    status,
    stop,
    toggle,
    track: playlist[index],
    volume,
  };
}

export type Music = ReturnType<typeof useMusic>;
