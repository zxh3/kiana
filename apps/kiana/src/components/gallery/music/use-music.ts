import { useCallback, useEffect, useRef, useState } from "react";
import { parseFlag, parseLevel, useStoredState } from "../use-stored-state";
import {
  nextTrackIndex,
  parseRepeat,
  parseShuffle,
  previousTrackIndex,
  type Repeat,
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
const SHUFFLE_KEY = "kiana.music-shuffle";
const REPEAT_KEY = "kiana.music-repeat";
const MUTED_KEY = "kiana.music-muted";
const DEFAULT_VOLUME = 60;
const BLOCKED_AFTER = 2_500;
/** Past this many seconds, previous restarts the song instead. */
const RESTART_AFTER = 3;
const SHUFFLE_MEMORY = 50;

function parseVolume(raw: string | null) {
  return parseLevel(raw, DEFAULT_VOLUME);
}

/** The saved track is stored by video id, so reordering keeps the place. */
function parseTrackIndex(raw: string | null) {
  const index = playlist.findIndex(({ videoId }) => videoId === raw);
  return index >= 0 ? index : 0;
}

function serializeTrackIndex(index: number) {
  return playlist[index]?.videoId ?? "";
}

function applyVolume(player: YouTubePlayer, volume: number, muted: boolean) {
  if (muted || volume === 0) {
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
  const [shuffle, saveShuffle] = useStoredState(SHUFFLE_KEY, parseShuffle);
  const [repeat, saveRepeat] = useStoredState(REPEAT_KEY, parseRepeat);
  // Muting keeps the volume, so unmuting returns to the same level.
  const [muted, saveMuted] = useStoredState(MUTED_KEY, parseFlag);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const blockedTimer = useRef<number>(undefined);
  const failures = useRef(0);
  const shuffleHistory = useRef<number[]>([]);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const indexRef = useRef(index);
  indexRef.current = index;
  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;
  const repeatRef = useRef<Repeat>(repeat);
  repeatRef.current = repeat;

  const destroy = useCallback(() => {
    window.clearTimeout(blockedTimer.current);
    playerRef.current?.destroy();
    playerRef.current = null;
    hostRef.current?.replaceChildren();
  }, []);

  /** Switch to a track; the player keeps running, so sound never stops. */
  const load = useCallback(
    (next: number, remember = true) => {
      if (remember && shuffleRef.current) {
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
              applyVolume(player, volumeRef.current, mutedRef.current);
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
                if (repeatRef.current === "one") {
                  player.seekTo(0, true);
                  player.playVideo();
                } else {
                  load(
                    nextTrackIndex(
                      indexRef.current,
                      playlist.length,
                      shuffleRef.current,
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
    load(nextTrackIndex(indexRef.current, playlist.length, shuffleRef.current));
  }, [load]);

  const previous = useCallback(() => {
    const player = playerRef.current;
    if (player && (player.getCurrentTime?.() ?? 0) > RESTART_AFTER) {
      player.seekTo(0, true);
      return;
    }
    const remembered = shuffleRef.current
      ? shuffleHistory.current.pop()
      : undefined;
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

  const setShuffle = useCallback(
    (next: boolean) => {
      shuffleHistory.current = [];
      shuffleRef.current = next;
      saveShuffle(next);
    },
    [saveShuffle],
  );

  const setRepeat = useCallback(
    (next: Repeat) => {
      repeatRef.current = next;
      saveRepeat(next);
    },
    [saveRepeat],
  );

  /** Setting a level also unmutes, as turning a volume knob would. */
  const setVolume = useCallback(
    (value: number) => {
      volumeRef.current = value;
      mutedRef.current = false;
      saveVolume(value);
      saveMuted(false);
      if (playerRef.current) applyVolume(playerRef.current, value, false);
    },
    [saveMuted, saveVolume],
  );

  const setMuted = useCallback(
    (value: boolean) => {
      mutedRef.current = value;
      saveMuted(value);
      if (playerRef.current) {
        applyVolume(playerRef.current, volumeRef.current, value);
      }
    },
    [saveMuted],
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
    hostRef,
    index,
    muted,
    next,
    pause,
    playTrack,
    playlist,
    preload,
    previous,
    readProgress,
    repeat,
    seek,
    setRepeat,
    setShuffle,
    setMuted,
    setVolume,
    start,
    shuffle,
    status,
    stop,
    toggle,
    track: playlist[index],
    volume,
  };
}

export type Music = ReturnType<typeof useMusic>;
