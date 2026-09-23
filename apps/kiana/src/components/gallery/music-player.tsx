import type { CSSProperties } from "react";
import { useRef } from "react";

import { cx } from "../../lib/class-names";
import { ControlButton, focusRing } from "./control-button";
import {
  CloseIcon,
  EqualizerIcon,
  ExternalIcon,
  MusicNoteIcon,
  PauseIcon,
  PlayIcon,
  SoundOffIcon,
  SoundOnIcon,
} from "./icons";
import { backgroundTrack } from "./music-track";
import type { Music, MusicStatus } from "./use-music";

const statusLabels: Record<MusicStatus, string> = {
  idle: "Music",
  loading: "Loading",
  playing: "Playing",
  paused: "Paused",
  blocked: "Tap the video",
  error: "Unavailable",
};

/** The top-bar switch: starts the music, then pauses and resumes it. */
export function MusicButton({ music }: { music: Music }) {
  const playing = music.status === "playing";
  const label =
    music.status === "idle"
      ? `Play background music: ${backgroundTrack.title}`
      : playing
        ? "Pause the music"
        : "Play the music";

  return (
    <button
      aria-label={label}
      aria-pressed={music.status === "idle" ? undefined : playing}
      className={cx(
        "glass flex h-10 cursor-pointer items-center gap-2 rounded-full px-3 transition-[color,background-color] duration-200 hover:bg-night/70 hover:text-paper sm:pr-4 sm:pl-3.5",
        playing ? "text-paper" : "text-paper/85",
        focusRing,
      )}
      onClick={music.toggle}
      onFocus={music.preload}
      onPointerEnter={music.preload}
      title={label}
      type="button"
    >
      {music.status === "idle" ? (
        <MusicNoteIcon size={17} />
      ) : (
        <EqualizerIcon playing={playing} />
      )}
      <span className="label max-sm:sr-only">{statusLabels[music.status]}</span>
    </button>
  );
}

/**
 * The now-playing card. It shows YouTube's player itself, at least 200px
 * square and never covered, because YouTube does not allow hidden or
 * audio-only playback. It sits above the photos, menus, and library.
 */
export function MusicPlayer({
  music,
  raised,
}: {
  music: Music;
  raised: boolean;
}) {
  const lastVolume = useRef(music.volume || 60);
  if (music.status === "idle") return null;

  const playing = music.status === "playing";
  const muted = music.volume === 0;
  const hint =
    music.status === "blocked"
      ? "Your browser needs a tap on the video to start the sound."
      : null;

  return (
    <aside
      aria-label="Music"
      className={cx(
        "fixed z-50 transition-[bottom,opacity,translate] duration-500 ease-soft starting:translate-y-3 starting:opacity-0",
        // Phones and tablets: under the top bar, clear of the caption and
        // dock. Desktop: bottom right, lifted over the dock while it shows.
        "top-[calc(max(16px,env(safe-area-inset-top))+60px)] right-[max(12px,env(safe-area-inset-right))] sm:top-[84px] sm:right-7",
        "lg:top-auto lg:bottom-6 lg:data-raised:bottom-[92px] xl:data-raised:bottom-6",
      )}
      data-raised={raised || undefined}
    >
      <div className="glass w-[220px] rounded-[22px] bg-night/82 p-2.5 text-paper sm:w-[376px]">
        <div className="relative size-[200px] overflow-hidden rounded-[12px] bg-black sm:w-[356px]">
          {/* Behind the player while it loads: the track's own thumbnail. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-xl"
            style={{
              backgroundImage: `url("https://i.ytimg.com/vi/${backgroundTrack.videoId}/hqdefault.jpg")`,
            }}
          />
          {music.status === "loading" ? (
            <div className="absolute inset-0 grid place-items-center">
              <span className="animate-breathe text-paper">
                <MusicNoteIcon size={28} />
              </span>
            </div>
          ) : null}
          <div className="absolute inset-0" ref={music.hostRef} />
        </div>

        <div className="flex items-center gap-3 pt-3 pr-0.5 pl-2">
          <EqualizerIcon className="shrink-0 text-paper/80" playing={playing} />
          <div className="min-w-0 flex-1">
            <p
              className="truncate font-serif text-[21px] leading-none"
              lang="zh-Hant"
            >
              {backgroundTrack.title}
            </p>
            <p className="label mt-2 truncate text-paper/45">
              {backgroundTrack.artist}
              <span className="max-sm:hidden"> · {backgroundTrack.source}</span>
            </p>
          </div>
          <button
            aria-label={playing ? "Pause the music" : "Play the music"}
            className={cx(
              "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-paper text-ink transition-[background-color,scale] duration-200 hover:bg-white active:scale-92",
              focusRing,
            )}
            onClick={music.toggle}
            title={playing ? "Pause" : "Play"}
            type="button"
          >
            {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
          </button>
          <ControlButton
            className="-ml-1"
            label="Close the music player"
            onClick={music.stop}
          >
            <CloseIcon size={18} />
          </ControlButton>
        </div>

        {hint ? (
          <p className="px-2 pt-2 text-[11px] leading-snug text-paper/60">
            {hint}
          </p>
        ) : null}
        {music.status === "error" ? (
          <div className="px-2 pt-2">
            <p className="text-[11px] leading-snug text-paper/60">
              YouTube wouldn’t play the song here. If it asks you to sign in,
              sign in on youtube.com in this browser, then try again.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={cx(
                  "label cursor-pointer rounded-full bg-paper px-3.5 py-2.5 text-ink transition-colors hover:bg-white",
                  focusRing,
                )}
                onClick={music.start}
                type="button"
              >
                Try again
              </button>
              <a
                className={cx(
                  "label flex items-center gap-1.5 rounded-full border border-paper/15 px-3.5 py-2.5 text-paper/75 transition-colors hover:border-paper/40 hover:text-paper",
                  focusRing,
                )}
                href={backgroundTrack.url}
                rel="noreferrer"
                target="_blank"
              >
                Open on YouTube
                <ExternalIcon size={12} />
              </a>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 pt-1 pr-1 pl-0.5">
          <ControlButton
            className="size-8"
            label={muted ? "Unmute the music" : "Mute the music"}
            onClick={() => {
              if (muted) {
                music.setVolume(lastVolume.current || 60);
              } else {
                lastVolume.current = music.volume;
                music.setVolume(0);
              }
            }}
          >
            {muted ? <SoundOffIcon size={16} /> : <SoundOnIcon size={16} />}
          </ControlButton>
          <input
            aria-label="Music volume"
            className="range min-w-0 flex-1"
            max={100}
            min={0}
            onChange={(event) => music.setVolume(Number(event.target.value))}
            step={1}
            style={{ "--value": `${music.volume}%` } as CSSProperties}
            type="range"
            value={music.volume}
          />
          <a
            className={cx(
              "label ml-1 flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1 text-paper/40 transition-colors hover:text-paper",
              focusRing,
            )}
            href={backgroundTrack.url}
            rel="noreferrer"
            target="_blank"
            title="Open on YouTube"
          >
            <span className="max-sm:sr-only">YouTube</span>
            <ExternalIcon size={12} />
          </a>
        </div>
      </div>
    </aside>
  );
}
