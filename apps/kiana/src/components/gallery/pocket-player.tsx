import { AnimatePresence, motion, type Variants } from "motion/react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { easeSoft } from "../../lib/motion";
import { cue } from "../../lib/sounds";
import { ClickWheel, useScrollSteps } from "./click-wheel";
import { type Finish, finishLabels, nextFinish } from "./ipod-finishes";
import {
  clamp,
  type ListScreen,
  menuItems,
  menuLabels,
  moveSelection,
  parentScreen,
  type Screen,
  screenTitles,
  settingsItems,
  settingsLabels,
} from "./ipod-menu";
import {
  MenuPreview,
  type NowOverlay,
  NowPlaying,
  PodList,
  type PodRow,
  StatusBar,
} from "./ipod-screen";
import { playModeLabels } from "./music-queue";
import { trackUrl } from "./music-track";
import type { Music } from "./use-music";

const VOLUME_STEP = 3;
const SCRUB_STEP = 3;
const VOLUME_SHOWS_FOR = 1_600;
const SCRUBBER_SHOWS_FOR = 3_500;
const SEEK_AFTER = 250;

/** The window's dark border around the display. */
const DISPLAY_INSET = 4;

/**
 * The aluminium around the screen. A generous margin, as on the original,
 * lets the window's small corners sit comfortably inside the body's large
 * ones; a tight one makes the two curves fight.
 */
export const BODY_PADDING = 18;

/**
 * Where the glass window and the display inside it sit within the player's
 * body, so the video can cover the display exactly and the glare can lie
 * over both.
 */
export const glassFrame = {
  top: BODY_PADDING,
  left: BODY_PADDING,
  width: 212,
  height: 159,
};
export const displayFrame = {
  top: glassFrame.top + DISPLAY_INSET,
  left: glassFrame.left + DISPLAY_INSET,
  width: glassFrame.width - DISPLAY_INSET * 2,
  height: glassFrame.height - DISPLAY_INSET * 2,
};
/** The video overlaps the dark border by a pixel, so no white edge shows. */
export const videoFrame = {
  top: displayFrame.top - 1,
  left: displayFrame.left - 1,
  width: displayFrame.width + 2,
  height: displayFrame.height + 2,
};

/** Deeper screens slide in from the right; Menu slides them back out. */
const slide: Variants = {
  enter: (direction: number) => ({ x: `${direction * 100}%` }),
  center: { x: 0 },
  exit: (direction: number) => ({ x: `${direction * -100}%` }),
};

/**
 * The full music player, after the classic pocket players: a colour screen
 * with menus, and a click wheel to drive them. It fills the space the
 * player's body gives it; the YouTube frame sits over the screen when the
 * video is on.
 */
export function PocketPlayer({
  finish,
  music,
  onFinishChange,
  onVideoChange,
  progress,
  videoOn,
}: {
  finish: Finish;
  music: Music;
  onFinishChange: (finish: Finish) => void;
  onVideoChange: (on: boolean) => void;
  progress: { current: number; duration: number };
  videoOn: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<Screen>("now");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<Record<ListScreen, number>>({
    menu: 0,
    songs: music.index,
    settings: 0,
  });
  const [overlay, setOverlay] = useState<NowOverlay>(null);
  const [scrubAt, setScrubAt] = useState<number | null>(null);
  const overlayTimer = useRef<number>(undefined);
  const seekTimer = useRef<number>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(overlayTimer.current);
      window.clearTimeout(seekTimer.current);
    },
    [],
  );

  const playing = music.status === "playing";
  const { track } = music;

  const rows: Record<ListScreen, PodRow[]> = {
    menu: menuItems.map((item) => ({
      key: item,
      label: menuLabels[item],
      opens: item === "now" || item === "songs" || item === "settings",
    })),
    songs: music.playlist.map((song, position) => ({
      key: song.videoId,
      label: song.title,
      current: position === music.index,
      lang: "zh",
    })),
    settings: settingsItems.map((item) => ({
      key: item,
      label: settingsLabels[item],
      detail:
        item === "mode"
          ? playModeLabels[music.mode]
          : item === "video"
            ? videoOn
              ? "On"
              : "Off"
            : item === "finish"
              ? finishLabels[finish]
              : undefined,
      opens: item === "youtube",
    })),
  };

  const go = (to: Screen, towards: 1 | -1) => {
    window.clearTimeout(overlayTimer.current);
    setOverlay(null);
    setScrubAt(null);
    setDirection(towards);
    setScreen(to);
  };

  const showOverlay = (kind: Exclude<NowOverlay, null>, duration: number) => {
    setOverlay(kind);
    window.clearTimeout(overlayTimer.current);
    overlayTimer.current = window.setTimeout(() => {
      setOverlay(null);
      setScrubAt(null);
    }, duration);
  };

  const activate = (list: ListScreen, index: number) => {
    cue("select");
    setSelected((previous) => ({ ...previous, [list]: index }));
    if (list === "songs") {
      music.playTrack(index);
      go("now", 1);
      return;
    }
    if (list === "menu") {
      const item = menuItems[index];
      if (item === "now") go("now", 1);
      else if (item === "songs") {
        setSelected((previous) => ({ ...previous, songs: music.index }));
        go("songs", 1);
      } else if (item === "shuffle") {
        music.setMode("shuffle");
        music.next();
        go("now", 1);
      } else go("settings", 1);
      return;
    }
    const item = settingsItems[index];
    if (item === "mode") music.cycleMode();
    else if (item === "video") onVideoChange(!videoOn);
    else if (item === "finish") onFinishChange(nextFinish(finish));
    else window.open(trackUrl(track), "_blank", "noopener,noreferrer");
  };

  const step = (steps: number) => {
    if (screen !== "now") {
      const next = moveSelection(selected[screen], steps, rows[screen].length);
      if (next === selected[screen]) return;
      cue("wheel");
      setSelected((previous) => ({ ...previous, [screen]: next }));
      return;
    }
    if (overlay === "scrub") {
      if (progress.duration <= 0) return;
      const target = clamp(
        (scrubAt ?? progress.current) + steps * SCRUB_STEP,
        0,
        progress.duration - 1,
      );
      cue("wheel");
      setScrubAt(target);
      window.clearTimeout(seekTimer.current);
      seekTimer.current = window.setTimeout(
        () => music.seek(target),
        SEEK_AFTER,
      );
      showOverlay("scrub", SCRUBBER_SHOWS_FOR);
      return;
    }
    const volume = clamp(music.volume + steps * VOLUME_STEP, 0, 100);
    if (volume !== music.volume) {
      cue("wheel");
      music.setVolume(volume);
    }
    showOverlay("volume", VOLUME_SHOWS_FOR);
  };

  useScrollSteps(rootRef, step);

  const select = () => {
    if (screen !== "now") {
      activate(screen, selected[screen]);
      return;
    }
    cue("press");
    if (overlay === "scrub") {
      window.clearTimeout(overlayTimer.current);
      setOverlay(null);
      setScrubAt(null);
    } else {
      setScrubAt(null);
      showOverlay("scrub", SCRUBBER_SHOWS_FOR);
    }
  };

  const back = () => {
    cue("press");
    if (videoOn) {
      onVideoChange(false);
      return;
    }
    const parent = parentScreen[screen];
    if (parent) go(parent, -1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    step(event.key === "ArrowDown" ? 1 : -1);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: arrow keys turn the wheel for whichever control inside has focus
    <div
      className="flex flex-col items-center"
      onKeyDown={handleKeyDown}
      ref={rootRef}
    >
      {/* The glass window, with the display set inside its dark border. */}
      <div
        className="rounded-[9px] bg-[#0a0a0b] shadow-[0_0_0_1px_rgb(0_0_0/.28),inset_0_0_0_1px_rgb(255_255_255/.05)]"
        style={{
          padding: DISPLAY_INSET,
          width: glassFrame.width,
          height: glassFrame.height,
        }}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-[2px] bg-white font-pod">
          <StatusBar
            state={
              playing
                ? "playing"
                : music.status === "paused"
                  ? "paused"
                  : "none"
            }
            title={screenTitles[screen]}
          />
          <div className="relative flex-1 overflow-hidden">
            <AnimatePresence custom={direction} initial={false}>
              <motion.div
                animate="center"
                className="absolute inset-0 bg-white"
                custom={direction}
                exit="exit"
                initial="enter"
                key={screen}
                transition={{ duration: 0.26, ease: easeSoft }}
                variants={slide}
              >
                {screen === "now" ? (
                  <NowPlaying
                    count={music.playlist.length}
                    current={scrubAt ?? progress.current}
                    duration={progress.duration}
                    index={music.index}
                    loading={music.status === "loading"}
                    mode={music.mode}
                    overlay={overlay}
                    track={track}
                    volume={music.volume}
                  />
                ) : (
                  <div className="flex h-full">
                    <div className={screen === "menu" ? "w-[56%]" : "w-full"}>
                      <PodList
                        label={screenTitles[screen]}
                        onHover={(index) =>
                          setSelected((previous) => ({
                            ...previous,
                            [screen]: index,
                          }))
                        }
                        onPick={(index) => activate(screen, index)}
                        rows={rows[screen]}
                        selected={selected[screen]}
                      />
                    </div>
                    {screen === "menu" ? (
                      <div className="flex-1">
                        <MenuPreview track={track} />
                      </div>
                    ) : null}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mt-[22px]">
        <ClickWheel
          onMenu={back}
          onNext={() => {
            cue("songNext");
            music.next();
          }}
          onPlayPause={() => {
            cue("press");
            music.toggle();
          }}
          onPrevious={() => {
            cue("songPrevious");
            music.previous();
          }}
          onSelect={select}
          onStep={step}
          playing={playing}
        />
      </div>
    </div>
  );
}
