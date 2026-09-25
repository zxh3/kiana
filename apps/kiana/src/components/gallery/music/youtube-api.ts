/**
 * The subset of the YouTube IFrame Player API the music player uses.
 * https://developers.google.com/youtube/iframe_api_reference
 */
export type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  mute: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  unMute: () => void;
};

type PlayerEvent = { target: YouTubePlayer; data: number };

type YouTubePlayerOptions = {
  events: {
    onError: (event: PlayerEvent) => void;
    onReady: (event: PlayerEvent) => void;
    onStateChange: (event: PlayerEvent) => void;
  };
  height: string;
  host: string;
  playerVars: Record<string, string | number>;
  videoId: string;
  width: string;
};

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const PlayerState = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
} as const;

let pending: Promise<YouTubeNamespace> | null = null;

/** Loads the IFrame API once, on demand, so the page stays light until used. */
export function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;

  pending = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      pending = null;
      script.remove();
      reject(new Error("The YouTube player could not be loaded."));
    };
    document.head.append(script);
  });
  return pending;
}
