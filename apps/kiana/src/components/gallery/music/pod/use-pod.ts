import { useEffect, useRef, useState } from "react";

import { cue } from "../../../../lib/sounds";
import { playModeLabels } from "../music-queue";
import { trackUrl } from "../music-track";
import type { Music } from "../use-music";
import { finishLabels, nextFinish } from "./finishes";
import {
  type ChoiceScreen,
  clamp,
  type ListScreen,
  menuItems,
  menuLabels,
  menuOpens,
  moveSelection,
  parentScreen,
  type Screen,
  settingsItems,
  settingsLabels,
} from "./menu";
import type { NowOverlay } from "./screen/now-playing";
import type { PodRow } from "./screen/pod-list";
import {
  BACKLIGHT_TIMEOUT,
  backlightLabels,
  type PodSettings,
} from "./settings";
import { useBacklight } from "./use-backlight";

const VOLUME_STEP = 3;
const SCRUB_STEP = 3;
const VOLUME_SHOWS_FOR = 1_600;
const SCRUBBER_SHOWS_FOR = 3_500;
const LOCK_SHOWS_FOR = 1_100;
const SEEK_AFTER = 250;

type Progress = { current: number; duration: number };

/**
 * Everything the pocket player does, apart from how it looks: which screen
 * is showing, what each control does there, the hold switch, and the
 * backlight. The component only draws what this returns.
 */
export function usePod({
  music,
  onVideoChange,
  progress,
  settings,
  videoOn,
}: {
  music: Music;
  onVideoChange: (on: boolean) => void;
  progress: Progress;
  settings: PodSettings;
  videoOn: boolean;
}) {
  const [screen, setScreen] = useState<Screen>("now");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<Record<ChoiceScreen, number>>({
    menu: 0,
    covers: music.index,
    songs: music.index,
    settings: 0,
  });
  const [overlay, setOverlay] = useState<NowOverlay>(null);
  const [scrubAt, setScrubAt] = useState<number | null>(null);
  const [held, setHeld] = useState(false);
  const [lockShown, setLockShown] = useState(false);
  const backlight = useBacklight(
    settings.backlight === "timed" && !videoOn ? BACKLIGHT_TIMEOUT : null,
  );
  const overlayTimer = useRef<number>(undefined);
  const seekTimer = useRef<number>(undefined);
  const lockTimer = useRef<number>(undefined);

  // When the song changes (the wheel's ⏮ ⏭, a song ending, shuffle), the
  // song lists follow it, so Cover Flow's middle cover is what is playing.
  useEffect(() => {
    setSelected((previous) => ({
      ...previous,
      covers: music.index,
      songs: music.index,
    }));
  }, [music.index]);

  useEffect(
    () => () => {
      window.clearTimeout(overlayTimer.current);
      window.clearTimeout(seekTimer.current);
      window.clearTimeout(lockTimer.current);
    },
    [],
  );

  const rows: Record<ListScreen, PodRow[]> = {
    menu: menuItems.map((item) => ({
      key: item,
      label: menuLabels[item],
      opens: menuOpens[item],
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
      detail: {
        mode: playModeLabels[music.mode],
        backlight: backlightLabels[settings.backlight],
        clicker: settings.clicker ? "On" : "Off",
        video: videoOn ? "On" : "Off",
        finish: finishLabels[settings.finish],
        youtube: undefined,
      }[item],
      opens: item === "youtube",
    })),
  };
  const choiceCount = (on: ChoiceScreen) =>
    on === "covers" ? music.playlist.length : rows[on].length;

  /** The wheel's own tick, unless the clicker is off. */
  const click = () => {
    if (settings.clicker) cue("wheel");
  };

  const choose = (on: ChoiceScreen, index: number) =>
    setSelected((previous) => ({ ...previous, [on]: index }));

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

  /** With the hold switch on, controls only show the padlock. */
  const unlessHeld =
    <Args extends unknown[]>(action: (...args: Args) => void) =>
    (...args: Args) => {
      backlight.wake();
      if (!held) {
        action(...args);
        return;
      }
      setLockShown(true);
      window.clearTimeout(lockTimer.current);
      lockTimer.current = window.setTimeout(
        () => setLockShown(false),
        LOCK_SHOWS_FOR,
      );
    };

  const playSong = (index: number) => {
    music.playTrack(index);
    go("now", 1);
  };

  const activate = (on: ChoiceScreen, index: number) => {
    cue("select");
    choose(on, index);
    if (on === "songs" || on === "covers") {
      playSong(index);
      return;
    }
    if (on === "menu") {
      const item = menuItems[index];
      if (item === "covers" || item === "songs") {
        choose(item, music.index);
        go(item, 1);
      } else if (item === "shuffle") {
        music.setMode("shuffle");
        music.next();
        go("now", 1);
      } else go(item, 1);
      return;
    }
    const item = settingsItems[index];
    if (item === "mode") music.cycleMode();
    else if (item === "backlight") {
      settings.setBacklight(
        settings.backlight === "timed" ? "always" : "timed",
      );
    } else if (item === "clicker") settings.setClicker(!settings.clicker);
    else if (item === "video") onVideoChange(!videoOn);
    else if (item === "finish") settings.setFinish(nextFinish(settings.finish));
    else window.open(trackUrl(music.track), "_blank", "noopener,noreferrer");
  };

  const turnVolume = (steps: number) => {
    const volume = clamp(music.volume + steps * VOLUME_STEP, 0, 100);
    if (volume !== music.volume) {
      click();
      music.setVolume(volume);
    }
    showOverlay("volume", VOLUME_SHOWS_FOR);
  };

  const turnScrubber = (steps: number) => {
    if (progress.duration <= 0) return;
    const target = clamp(
      (scrubAt ?? progress.current) + steps * SCRUB_STEP,
      0,
      progress.duration - 1,
    );
    click();
    setScrubAt(target);
    window.clearTimeout(seekTimer.current);
    seekTimer.current = window.setTimeout(() => music.seek(target), SEEK_AFTER);
    showOverlay("scrub", SCRUBBER_SHOWS_FOR);
  };

  const step = (steps: number) => {
    if (screen === "now") {
      if (overlay === "scrub") turnScrubber(steps);
      else turnVolume(steps);
      return;
    }
    const next = moveSelection(selected[screen], steps, choiceCount(screen));
    if (next === selected[screen]) return;
    click();
    choose(screen, next);
  };

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

  /** A tap on a cover: the middle one plays, a side one comes to the middle. */
  const pickCover = (index: number) => {
    if (index === selected.covers) {
      activate("covers", index);
      return;
    }
    click();
    choose("covers", index);
  };

  const toggleHold = () => {
    backlight.wake();
    cue(held ? "switchOff" : "switchOn");
    setHeld(!held);
    if (held) setLockShown(false);
  };

  return {
    held,
    lit: backlight.lit,
    lockShown,
    rows,
    screen,
    direction,
    selected,
    overlay,
    scrubAt,
    /** Counts as a touch, for the backlight. */
    wake: backlight.wake,
    toggleHold,
    controls: {
      back: unlessHeld(back),
      hover: (on: ChoiceScreen, index: number) => {
        if (!held) choose(on, index);
      },
      next: unlessHeld(() => {
        cue("songNext");
        music.next();
      }),
      pick: unlessHeld(activate),
      pickCover: unlessHeld(pickCover),
      playPause: unlessHeld(() => {
        cue("press");
        music.toggle();
      }),
      previous: unlessHeld(() => {
        cue("songPrevious");
        music.previous();
      }),
      select: unlessHeld(select),
      step: unlessHeld(step),
    },
  };
}

export type Pod = ReturnType<typeof usePod>;
