import {
  type CSSProperties,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { cx } from "../../lib/class-names";
import { ControlButton, focusRing } from "./control-button";
import {
  CheckIcon,
  CloseIcon,
  EqualizerIcon,
  ExternalIcon,
  GripIcon,
  ListIcon,
  MinimizeIcon,
  MusicNoteIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  ScreenIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SoundOffIcon,
  SoundOnIcon,
} from "./icons";
import { Marquee } from "./marquee";
import { type Corner, parseCorner, parsePlayerSize } from "./music-layout";
import { type PlayMode, playModeNames, playModes } from "./music-queue";
import { trackThumbnail, trackUrl } from "./music-track";
import { Popover } from "./popover";
import { parseFlag } from "./preferences";
import { Spectrum } from "./spectrum";
import { useCornerDrag } from "./use-corner-drag";
import { useMediaQuery } from "./use-media-query";
import type { Music, MusicStatus } from "./use-music";
import { useStoredState } from "./use-stored-state";

const SIZE_KEY = "kiana.music-size";
const CORNER_KEY = "kiana.music-corner";
const LIST_KEY = "kiana.music-list";
const PHONE_QUERY = "(max-width: 639px)";
const SWIPE_TO_MINIMIZE = 48;

const statusLabels: Record<MusicStatus, string> = {
  idle: "Music",
  loading: "Loading",
  playing: "Playing",
  paused: "Paused",
  blocked: "Tap the video",
  error: "Unavailable",
};

/** "03:07", the way a player's display reads. */
function formatClock(seconds: number) {
  const total =
    Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

/** The top-bar switch: starts the music, then pauses and resumes it. */
export function MusicButton({ music }: { music: Music }) {
  const playing = music.status === "playing";
  const label =
    music.status === "idle"
      ? `Play background music: ${music.track.title}`
      : playing
        ? `Pause ${music.track.title}`
        : `Play ${music.track.title}`;

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

function PlayModeIcon({ mode, size }: { mode: PlayMode; size: number }) {
  if (mode === "shuffle") return <ShuffleIcon size={size} />;
  return <RepeatIcon one={mode === "one"} size={size} />;
}

function PlayPause({ music, size }: { music: Music; size: "small" | "large" }) {
  const playing = music.status === "playing";
  return (
    <button
      aria-label={playing ? "Pause the music" : "Play the music"}
      className={cx(
        "grid shrink-0 cursor-pointer place-items-center rounded-full bg-paper text-ink transition-[background-color,scale,box-shadow] duration-200 hover:bg-white active:scale-92",
        size === "small"
          ? "size-9"
          : "size-14 shadow-[0_10px_30px_-10px_rgba(244,198,124,.55)]",
        focusRing,
      )}
      onClick={music.toggle}
      title={playing ? "Pause" : "Play"}
      type="button"
    >
      {playing ? (
        <PauseIcon size={size === "small" ? 16 : 22} />
      ) : (
        <PlayIcon size={size === "small" ? 16 : 22} />
      )}
    </button>
  );
}

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

/**
 * The now-playing widget, above the photos, menus, and library: a modern
 * take on the classic desktop music players, with an amber display, a
 * spectrum, transport controls, and a docked playlist.
 *
 * It is a small pill (the default on phones) or the full deck. On wider
 * screens the deck can be dragged to any corner, where it stays; on phones
 * it rises as a bottom sheet that a swipe down tucks away.
 *
 * YouTube's player stays mounted at full size throughout, so playback never
 * stops, collapsed and transparent until needed. It opens by itself when
 * YouTube needs a tap or a sign-in, and a toggle shows it on demand. Hiding
 * a playing embed goes against YouTube's API policies (III.I.9); that
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
  const [listOpen, setListOpen] = useStoredState(LIST_KEY, parseFlag);
  const phone = useMediaQuery(PHONE_QUERY);
  const drag = useCornerDrag<HTMLElement>({
    corner,
    onCornerChange: setCorner,
  });
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [scrub, setScrub] = useState<number | null>(null);
  const [modeMenu, setModeMenu] = useState(false);
  const swipe = useRef<number | null>(null);

  const idle = music.status === "idle";
  const playing = music.status === "playing";
  const needsVideo = music.status === "blocked" || music.status === "error";
  const mini = size === "mini" && !needsVideo;
  const sheet = phone && !mini;

  // Poll the clock only while the deck shows it, and only re-render here.
  const { readProgress } = music;
  useEffect(() => {
    if (idle || mini) return;
    const tick = () =>
      setProgress((previous) => {
        const next = readProgress();
        return Math.abs(next.current - previous.current) < 0.2 &&
          next.duration === previous.duration
          ? previous
          : next;
      });
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [idle, mini, readProgress]);

  if (idle) return null;

  const showVideo = !mini && (videoOpen || needsVideo);
  const muted = music.volume === 0;
  const { track } = music;
  const shown = scrub ?? progress.current;
  const percent =
    progress.duration > 0
      ? Math.min(100, (shown / progress.duration) * 100)
      : 0;
  const commitScrub = () => {
    if (scrub === null) return;
    music.seek(scrub);
    setScrub(null);
  };
  const modeName = playModeNames[music.mode];

  const handleSwipeStart = (event: PointerEvent<HTMLButtonElement>) => {
    swipe.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleSwipeEnd = (event: PointerEvent<HTMLButtonElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (start !== null && event.clientY - start > SWIPE_TO_MINIMIZE) {
      setSize("mini");
    }
  };

  return (
    <aside
      aria-label="Music"
      // Keys pressed in here belong to the player, not the slideshow.
      data-own-keys=""
      className={cx(
        "fixed z-50 transition-[bottom,opacity,translate] duration-500 ease-soft starting:translate-y-3 starting:opacity-0",
        sheet
          ? "inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))]"
          : cx(
              "touch-none select-none",
              cornerClasses[corner],
              drag.dragging ? "cursor-grabbing" : "cursor-grab",
            ),
      )}
      data-raised={raised || undefined}
      ref={drag.ref}
      title={sheet || drag.dragging ? undefined : "Drag to move"}
      {...(sheet ? {} : drag.handlers)}
    >
      <div
        className={cx(
          "glass text-paper transition-[scale,box-shadow] duration-300 ease-soft",
          mini
            ? "rounded-full bg-night/82 p-1"
            : cx(
                "overflow-y-auto overscroll-contain rounded-[26px] bg-night/88 p-3 scrollbar-none sm:w-[344px]",
                // Never taller than the room between the top bar and the
                // lowest corner offset; the deck scrolls inside instead.
                sheet
                  ? "max-h-[calc(100dvh-24px)]"
                  : "max-h-[calc(100dvh-212px)]",
              ),
          drag.dragging &&
            "scale-[1.03] shadow-[0_30px_80px_-24px_rgba(0,0,0,.85)]",
        )}
      >
        {sheet ? (
          <button
            aria-label="Minimize the music player"
            className="mx-auto -mt-1 mb-1 flex h-5 w-16 cursor-pointer touch-none items-center justify-center"
            onClick={() => setSize("mini")}
            onPointerDown={handleSwipeStart}
            onPointerUp={handleSwipeEnd}
            type="button"
          >
            <span className="h-1 w-9 rounded-full bg-paper/25" />
          </button>
        ) : null}

        {mini ? null : (
          <div className="flex animate-toast-in items-center gap-1.5 pb-2.5 pl-1.5">
            {sheet ? null : (
              <GripIcon className="-ml-1 shrink-0 text-paper/25" size={16} />
            )}
            <p className="label flex-1 text-paper/45">Now playing</p>
            <ControlButton
              className="size-8"
              disabled={needsVideo}
              label="Minimize the music player"
              onClick={() => setSize("mini")}
            >
              <MinimizeIcon size={17} />
            </ControlButton>
            <ControlButton
              className="size-8"
              label="Close the music player"
              onClick={music.stop}
            >
              <CloseIcon size={17} />
            </ControlButton>
          </div>
        )}

        {/* The player: one element for the widget's whole life, so switching
            between pill, deck, and sheet never interrupts the music. */}
        <div
          className={cx(
            "relative transition-[height,margin] duration-500 ease-soft motion-reduce:transition-none",
            showVideo ? "mb-2.5 h-[200px]" : "h-0",
          )}
        >
          <div
            className={cx(
              "absolute top-0 h-[200px] overflow-hidden rounded-[16px] bg-black transition-opacity duration-300",
              mini ? "left-0 w-[200px]" : "inset-x-0",
              showVideo ? "opacity-100" : "pointer-events-none -z-10 opacity-0",
            )}
            inert={!showVideo}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-xl"
              style={{ backgroundImage: `url("${trackThumbnail(track)}")` }}
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
              aria-label={`Open the music player: ${track.title}`}
              className={cx(
                "flex min-w-0 cursor-pointer items-center gap-2.5 rounded-full py-2 pr-1.5 pl-3 text-left",
                focusRing,
                "focus-visible:ring-offset-0",
              )}
              onClick={() => setSize("full")}
              type="button"
            >
              <EqualizerIcon
                className="shrink-0 text-amber"
                playing={playing}
              />
              <span
                className="max-w-[6rem] truncate font-serif text-[17px] leading-none sm:max-w-[8rem]"
                lang="zh"
              >
                {track.title}
              </span>
            </button>
            <PlayPause music={music} size="small" />
            <ControlButton
              className="size-9"
              label="Next song"
              onClick={music.next}
            >
              <SkipForwardIcon size={16} />
            </ControlButton>
          </div>
        ) : (
          <div className="animate-toast-in">
            {/* The display: an old player's screen, lit in amber. */}
            <div className="relative overflow-hidden rounded-[18px] border border-paper/8 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(244,198,124,.09),transparent_55%),linear-gradient(180deg,#0c0908,#15100d)] px-4 pt-3.5 pb-3 shadow-[inset_0_1px_0_rgba(246,240,230,.05),inset_0_14px_34px_rgba(0,0,0,.5)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[.06] [background-image:radial-gradient(rgba(246,240,230,.9)_0.6px,transparent_0.8px)] [background-size:3px_3px]"
              />
              <div className="relative flex items-end justify-between gap-3">
                <div className="flex items-baseline gap-2 text-amber [text-shadow:0_0_16px_rgba(244,198,124,.45)]">
                  <span className="self-center">
                    {playing ? <PlayIcon size={12} /> : <PauseIcon size={12} />}
                  </span>
                  <span className="font-mono text-[32px] leading-none font-light tracking-[-.02em] tabular-nums">
                    {formatClock(shown)}
                  </span>
                  <span className="font-mono text-[11px] text-amber/50 tabular-nums">
                    / {formatClock(progress.duration)}
                  </span>
                </div>
                <div className="pb-0.5 text-right">
                  <p className="font-mono text-[11px] tracking-[.14em] text-amber/80 tabular-nums">
                    {String(music.index + 1).padStart(2, "0")}
                    <span className="text-amber/35">
                      {" "}
                      / {String(music.playlist.length).padStart(2, "0")}
                    </span>
                  </p>
                  <p
                    className="mt-1.5 text-[11px] tracking-[.18em] text-paper/45"
                    lang="zh"
                  >
                    {modeName.zh}
                  </p>
                </div>
              </div>
              <Marquee className="relative mt-3">
                <span
                  className="font-serif text-[20px] leading-tight"
                  lang="zh"
                >
                  {track.title}
                </span>
                <span className="label ml-3 text-paper/45" lang="zh">
                  {track.artist}
                </span>
              </Marquee>
              <Spectrum
                active={!mini}
                className="relative mt-2.5 h-11 w-full"
                playing={playing}
              />
            </div>

            <input
              aria-label="Seek"
              aria-valuetext={`${formatClock(shown)} of ${formatClock(progress.duration)}`}
              className="range mt-3 w-full px-1"
              disabled={progress.duration <= 0}
              max={progress.duration || 1}
              min={0}
              onBlur={commitScrub}
              onChange={(event) => setScrub(Number(event.target.value))}
              onKeyUp={commitScrub}
              onPointerUp={commitScrub}
              step={0.5}
              style={
                {
                  "--value": `${percent}%`,
                  "--fill": "var(--color-amber)",
                } as CSSProperties
              }
              type="range"
              value={shown}
            />

            <div className="mt-1.5 flex items-center justify-between px-1">
              <Popover
                className="w-[228px] p-1.5"
                kind="menu"
                label="Play mode"
                onOpenChange={setModeMenu}
                open={modeMenu}
                placement="top-start"
                trigger={(props) => (
                  <ControlButton
                    {...props}
                    className={cx(
                      "size-10 text-amber hover:text-amber",
                      modeMenu && "bg-paper/10",
                    )}
                    label={`Play mode: ${modeName.zh} (${modeName.en})`}
                  >
                    <PlayModeIcon mode={music.mode} size={19} />
                  </ControlButton>
                )}
              >
                {playModes.map((option) => {
                  const name = playModeNames[option];
                  const checked = option === music.mode;
                  return (
                    <button
                      aria-checked={checked}
                      className={cx(
                        "flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-paper/8 focus-visible:bg-paper/10",
                        focusRing,
                        "focus-visible:ring-offset-0",
                      )}
                      key={option}
                      onClick={() => {
                        music.setMode(option);
                        setModeMenu(false);
                      }}
                      role="menuitemradio"
                      type="button"
                    >
                      <span
                        className={checked ? "text-amber" : "text-paper/55"}
                      >
                        <PlayModeIcon mode={option} size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cx(
                            "block text-[14px] leading-tight",
                            checked ? "text-amber" : "text-paper",
                          )}
                          lang="zh"
                        >
                          {name.zh}
                        </span>
                        <span className="label mt-1 block text-paper/40">
                          {name.en}
                        </span>
                      </span>
                      <span className="grid w-4 place-items-center text-amber">
                        {checked ? <CheckIcon size={15} /> : null}
                      </span>
                    </button>
                  );
                })}
              </Popover>
              <ControlButton
                className="size-11"
                label="Previous song"
                onClick={music.previous}
              >
                <SkipBackIcon size={20} />
              </ControlButton>
              <PlayPause music={music} size="large" />
              <ControlButton
                className="size-11"
                label="Next song"
                onClick={music.next}
              >
                <SkipForwardIcon size={20} />
              </ControlButton>
              <ControlButton
                aria-pressed={listOpen}
                className={cx(
                  "size-10",
                  listOpen && "text-amber hover:text-amber",
                )}
                label={listOpen ? "Hide the playlist" : "Show the playlist"}
                onClick={() => setListOpen(!listOpen)}
              >
                <ListIcon size={19} />
              </ControlButton>
            </div>

            <div className="mt-1 flex items-center gap-1.5 px-1 sm:gap-2">
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
                aria-label="Open this song on YouTube"
                className={cx(
                  "grid size-8 shrink-0 place-items-center rounded-full text-paper/45 transition-colors hover:text-paper",
                  focusRing,
                )}
                href={trackUrl(track)}
                rel="noreferrer"
                target="_blank"
                title="Open on YouTube"
              >
                <ExternalIcon size={14} />
              </a>
            </div>

            {music.status === "blocked" ? (
              <p className="px-2 pt-2 text-[11px] leading-snug text-paper/60">
                Your browser needs a tap on the video to start the sound.
              </p>
            ) : null}
            {music.status === "error" ? (
              <div className="px-2 pt-2">
                <p className="text-[11px] leading-snug text-paper/60">
                  YouTube wouldn’t play the playlist here. If it asks you to
                  sign in, sign in on youtube.com in this browser, then try
                  again.
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
                    href={trackUrl(track)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open on YouTube
                    <ExternalIcon size={12} />
                  </a>
                </div>
              </div>
            ) : null}

            {/* The docked playlist, folded away until asked for. */}
            <div
              className={cx(
                "grid transition-[grid-template-rows] duration-500 ease-soft motion-reduce:transition-none",
                listOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
              inert={!listOpen}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="mt-2.5 border-t border-paper/8 pt-2.5">
                  <div className="flex items-baseline justify-between px-2 pb-1.5">
                    <p className="label text-paper/45">Playlist</p>
                    <p className="label text-paper/30">
                      {music.playlist.length} songs
                    </p>
                  </div>
                  <ol
                    aria-label="Playlist"
                    className="max-h-[min(236px,32dvh)] overflow-y-auto overscroll-contain scrollbar-none"
                  >
                    {music.playlist.map((item, position) => {
                      const current = position === music.index;
                      return (
                        <li key={item.videoId}>
                          <button
                            aria-current={current || undefined}
                            className={cx(
                              "flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-1.5 text-left transition-colors duration-150",
                              current ? "bg-amber/[.09]" : "hover:bg-paper/6",
                              focusRing,
                              "focus-visible:ring-offset-0",
                            )}
                            onClick={() => music.playTrack(position)}
                            type="button"
                          >
                            <span
                              className={cx(
                                "grid w-5 shrink-0 place-items-center font-mono text-[11px] tabular-nums",
                                current ? "text-amber" : "text-paper/35",
                              )}
                            >
                              {current && playing ? (
                                <EqualizerIcon className="h-3! w-3!" playing />
                              ) : (
                                String(position + 1).padStart(2, "0")
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={cx(
                                  "block truncate font-serif text-[16px] leading-tight",
                                  current ? "text-amber" : "text-paper/90",
                                )}
                                lang="zh"
                              >
                                {item.title}
                              </span>
                              <span
                                className="label mt-1 block truncate text-paper/40"
                                lang="zh"
                              >
                                {item.artist}
                              </span>
                            </span>
                            {current && progress.duration > 0 ? (
                              <span className="font-mono text-[10px] text-amber/70 tabular-nums">
                                {formatClock(progress.duration)}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
