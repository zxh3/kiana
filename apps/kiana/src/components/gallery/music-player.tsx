import type { CSSProperties } from "react";
import { useRef, useState } from "react";

import { cx } from "../../lib/class-names";
import { ControlButton, focusRing } from "./control-button";
import {
  CloseIcon,
  EqualizerIcon,
  ExternalIcon,
  MinimizeIcon,
  MusicNoteIcon,
  PauseIcon,
  PlayIcon,
  ScreenIcon,
  SoundOffIcon,
  SoundOnIcon,
} from "./icons";
import { type Corner, parseCorner, parsePlayerSize } from "./music-layout";
import { backgroundTrack } from "./music-track";
import { useCornerDrag } from "./use-corner-drag";
import type { Music, MusicStatus } from "./use-music";
import { useStoredState } from "./use-stored-state";

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

const SIZE_KEY = "kiana.music-size";
const CORNER_KEY = "kiana.music-corner";

/**
 * Where each corner sits: clear of the top bar, the dock, and the caption
 * (which hangs bottom-left on wide screens), and inside the safe areas.
 */
const cornerClasses: Record<Corner, string> = {
  "top-left":
    "top-[calc(max(16px,env(safe-area-inset-top))+60px)] left-[max(12px,env(safe-area-inset-left))] sm:top-[84px] sm:left-7",
  "top-right":
    "top-[calc(max(16px,env(safe-area-inset-top))+60px)] right-[max(12px,env(safe-area-inset-right))] sm:top-[84px] sm:right-7",
  "bottom-left":
    "bottom-[calc(max(16px,env(safe-area-inset-bottom))+76px)] left-[max(12px,env(safe-area-inset-left))] sm:bottom-24 sm:left-7 lg:bottom-32",
  "bottom-right":
    "bottom-[calc(max(16px,env(safe-area-inset-bottom))+76px)] right-[max(12px,env(safe-area-inset-right))] sm:bottom-24 sm:right-7 lg:bottom-6 lg:data-raised:bottom-[92px] xl:data-raised:bottom-6",
};

function PlayPause({ music, small }: { music: Music; small?: boolean }) {
  const playing = music.status === "playing";
  return (
    <button
      aria-label={playing ? "Pause the music" : "Play the music"}
      className={cx(
        "grid shrink-0 cursor-pointer place-items-center rounded-full bg-paper text-ink transition-[background-color,scale] duration-200 hover:bg-white active:scale-92",
        small ? "size-9" : "size-10",
        focusRing,
      )}
      onClick={music.toggle}
      title={playing ? "Pause" : "Play"}
      type="button"
    >
      {playing ? (
        <PauseIcon size={small ? 16 : 18} />
      ) : (
        <PlayIcon size={small ? 16 : 18} />
      )}
    </button>
  );
}

/**
 * The now-playing widget, above the photos, menus, and library. It is a
 * small pill (the default on phones) or a card with every control, and it
 * can be dragged to any corner, where it stays.
 *
 * YouTube's player stays mounted at full size in both forms so playback
 * keeps going, collapsed and transparent until needed. It opens by itself
 * when YouTube needs a tap or a sign-in, and a toggle shows it on demand.
 * Hiding a playing embed goes against YouTube's API policies (III.I.9); that
 * trade-off was the site owner's choice.
 */
export function MusicPlayer({
  music,
  raised,
}: {
  music: Music;
  raised: boolean;
}) {
  const lastVolume = useRef(music.volume || 60);
  const [videoOpen, setVideoOpen] = useState(false);
  const [size, setSize] = useStoredState(SIZE_KEY, parsePlayerSize);
  const [corner, setCorner] = useStoredState(CORNER_KEY, parseCorner);
  const drag = useCornerDrag<HTMLElement>({
    corner,
    onCornerChange: setCorner,
  });
  if (music.status === "idle") return null;

  const playing = music.status === "playing";
  const needsVideo = music.status === "blocked" || music.status === "error";
  const mini = size === "mini" && !needsVideo;
  const showVideo = !mini && (videoOpen || needsVideo);
  const muted = music.volume === 0;

  return (
    <aside
      aria-label="Music"
      className={cx(
        "fixed z-50 touch-none transition-[bottom,opacity,translate] duration-500 ease-soft select-none starting:translate-y-3 starting:opacity-0",
        cornerClasses[corner],
        drag.dragging ? "cursor-grabbing" : "cursor-grab",
      )}
      data-raised={raised || undefined}
      ref={drag.ref}
      title={drag.dragging ? undefined : "Drag to move"}
      {...drag.handlers}
    >
      <div
        className={cx(
          "glass bg-night/82 text-paper transition-[scale,box-shadow] duration-300 ease-soft",
          mini
            ? "rounded-full p-1"
            : "w-[272px] rounded-[22px] p-2.5 sm:w-[320px]",
          drag.dragging &&
            "scale-[1.03] shadow-[0_30px_80px_-24px_rgba(0,0,0,.85)]",
        )}
      >
        {/* The player: one element for the widget's whole life, so switching
            between pill and card never interrupts the music. */}
        <div
          className={cx(
            "relative transition-[height,margin] duration-500 ease-soft motion-reduce:transition-none",
            showVideo ? "mb-1 h-[200px]" : "h-0",
          )}
        >
          <div
            className={cx(
              "absolute top-0 h-[200px] overflow-hidden rounded-[12px] bg-black transition-opacity duration-300",
              mini ? "left-0 w-[200px]" : "inset-x-0",
              showVideo ? "opacity-100" : "pointer-events-none -z-10 opacity-0",
            )}
            inert={!showVideo}
          >
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
        </div>

        {mini ? (
          <div className="flex animate-toast-in items-center gap-1">
            <button
              aria-label="Open the music player"
              className={cx(
                "flex min-w-0 cursor-pointer items-center gap-2.5 rounded-full py-2 pr-1.5 pl-3 text-left",
                focusRing,
                "focus-visible:ring-offset-0",
              )}
              onClick={() => setSize("full")}
              type="button"
            >
              <EqualizerIcon
                className="shrink-0 text-paper/85"
                playing={playing}
              />
              <span
                className="max-w-[7.5rem] truncate font-serif text-[17px] leading-none"
                lang="zh-Hant"
              >
                {backgroundTrack.title}
              </span>
            </button>
            <PlayPause music={music} small />
          </div>
        ) : (
          <div className="animate-toast-in">
            <div className="flex items-center gap-2 pt-1.5 pr-0.5 pl-2">
              <EqualizerIcon
                className="shrink-0 text-paper/80"
                playing={playing}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-serif text-[21px] leading-none"
                  lang="zh-Hant"
                >
                  {backgroundTrack.title}
                </p>
                <p className="label mt-2 truncate text-paper/45">
                  {backgroundTrack.artist}
                </p>
              </div>
              <ControlButton
                className="size-9"
                disabled={needsVideo}
                label="Minimize the music player"
                onClick={() => setSize("mini")}
              >
                <MinimizeIcon size={18} />
              </ControlButton>
              <ControlButton
                className="-ml-1 size-9"
                label="Close the music player"
                onClick={music.stop}
              >
                <CloseIcon size={18} />
              </ControlButton>
            </div>

            {music.status === "blocked" ? (
              <p className="px-2 pt-2 text-[11px] leading-snug text-paper/60">
                Your browser needs a tap on the video to start the sound.
              </p>
            ) : null}
            {music.status === "error" ? (
              <div className="px-2 pt-2">
                <p className="text-[11px] leading-snug text-paper/60">
                  YouTube wouldn’t play the song here. If it asks you to sign
                  in, sign in on youtube.com in this browser, then try again.
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

            <div className="flex items-center gap-1.5 pt-2.5 pr-1 pl-1 sm:gap-2">
              <PlayPause music={music} />
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
                onChange={(event) =>
                  music.setVolume(Number(event.target.value))
                }
                step={1}
                style={{ "--value": `${music.volume}%` } as CSSProperties}
                type="range"
                value={music.volume}
              />
              <ControlButton
                aria-pressed={showVideo}
                className={cx("size-8", showVideo && "text-paper")}
                disabled={needsVideo}
                label={showVideo ? "Hide the video" : "Show the video"}
                onClick={() => setVideoOpen(!videoOpen)}
              >
                <ScreenIcon size={16} />
              </ControlButton>
              <a
                aria-label="Open on YouTube"
                className={cx(
                  "grid size-8 shrink-0 place-items-center rounded-full text-paper/45 transition-colors hover:text-paper",
                  focusRing,
                )}
                href={backgroundTrack.url}
                rel="noreferrer"
                target="_blank"
                title="Open on YouTube"
              >
                <ExternalIcon size={14} />
              </a>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
