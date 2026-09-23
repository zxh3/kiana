import { useCallback, useEffect, useRef, useState } from "react";

import { cue } from "../../../../lib/sounds";
import type { Music } from "../use-music";
import { nextFinish } from "./finishes";
import {
  initialPodState,
  LOCK_SHOWS_FOR,
  overlayDurations,
  type PodAction,
  type PodContext,
  type PodEffect,
  podReducer,
  SEEK_SETTLE,
} from "./machine";
import { type ChoiceScreen, parentScreen, type SettingsItem } from "./menu";
import { describePod, type PodView, podRows } from "./rows";
import { BACKLIGHT_TIMEOUT, type PodSettings } from "./settings";
import { useBacklight } from "./use-backlight";

/**
 * Runs the pocket player's state machine (`machine.ts`) against the real
 * music and settings: each action is applied to the latest state at once,
 * its effects carried out, and its timers kept. Lives in the widget, above
 * the switch between the full and the small player, so minimizing keeps
 * the screen, the highlight, and the hold switch where they were.
 */
export function usePod({
  music,
  onVideoChange,
  progress,
  settings,
  videoCovers,
  videoOpen,
}: {
  music: Music;
  onVideoChange: (on: boolean) => void;
  progress: { current: number; duration: number };
  settings: PodSettings;
  /** The video covers the display (turned on, or YouTube needs a tap). */
  videoCovers: boolean;
  /** The viewer turned the video on. */
  videoOpen: boolean;
}) {
  const [state, setState] = useState(() => initialPodState(music.index));
  const stateRef = useRef(state);
  const backlight = useBacklight(
    settings.backlight === "timed" && !videoCovers ? BACKLIGHT_TIMEOUT : null,
  );

  // The latest facts, read by actions between renders. The volume is also
  // updated the moment the machine sets it, so fast turns build on it.
  const context = useRef<PodContext>(null as unknown as PodContext);
  context.current = {
    count: music.playlist.length,
    index: music.index,
    volume: music.volume,
    current: progress.current,
    duration: progress.duration,
    clicker: settings.clicker,
    videoOpen,
    videoCovers,
  };

  const applySetting = (item: SettingsItem) => {
    if (item === "shuffle") music.setShuffle(!music.shuffle);
    else if (item === "repeat") {
      music.setRepeat(music.repeat === "one" ? "all" : "one");
    } else if (item === "backlight") {
      settings.setBacklight(
        settings.backlight === "timed" ? "always" : "timed",
      );
    } else if (item === "clicker") settings.setClicker(!settings.clicker);
    else if (item === "video") onVideoChange(!videoOpen);
    else settings.setFinish(nextFinish(settings.finish));
  };

  const run = (effect: PodEffect) => {
    switch (effect.type) {
      case "cue":
        cue(effect.cue);
        break;
      case "play":
        music.playTrack(effect.index);
        break;
      case "next":
        music.next();
        break;
      case "previous":
        music.previous();
        break;
      case "toggle":
        music.toggle();
        break;
      case "shuffle":
        music.setShuffle(true);
        music.next();
        break;
      case "volume":
        context.current.volume = effect.volume;
        music.setVolume(effect.volume);
        break;
      case "seek":
        music.seek(effect.seconds);
        break;
      case "setting":
        applySetting(effect.item);
        break;
      case "closeVideo":
        onVideoChange(false);
        break;
    }
  };
  const runRef = useRef(run);
  runRef.current = run;

  const dispatch = useCallback((action: PodAction) => {
    const result = podReducer(stateRef.current, action, context.current);
    stateRef.current = result.state;
    setState(result.state);
    for (const effect of result.effects) runRef.current(effect);
  }, []);

  // The clock: the overlay fades, the wheel's scrubber lands, the padlock
  // goes, and the song lists follow the song that is playing.
  useEffect(() => {
    if (!state.overlay || state.touching) return;
    const stamp = state.overlayStamp;
    const timer = window.setTimeout(
      () => dispatch({ type: "overlayExpired", stamp }),
      overlayDurations[state.overlay],
    );
    return () => window.clearTimeout(timer);
  }, [dispatch, state.overlay, state.overlayStamp, state.touching]);

  useEffect(() => {
    if (!state.seekPending || state.scrubAt === null) return;
    const timer = window.setTimeout(
      () => dispatch({ type: "commitSeek" }),
      SEEK_SETTLE,
    );
    return () => window.clearTimeout(timer);
  }, [dispatch, state.seekPending, state.scrubAt]);

  useEffect(() => {
    if (!state.lockShown) return;
    const stamp = state.lockStamp;
    const timer = window.setTimeout(
      () => dispatch({ type: "lockExpired", stamp }),
      LOCK_SHOWS_FOR,
    );
    return () => window.clearTimeout(timer);
  }, [dispatch, state.lockShown, state.lockStamp]);

  useEffect(() => {
    dispatch({ type: "trackChanged", index: music.index });
  }, [dispatch, music.index]);

  const view: PodView = {
    playlist: music.playlist,
    index: music.index,
    shuffle: music.shuffle,
    repeat: music.repeat,
    backlight: settings.backlight,
    clicker: settings.clicker,
    finish: settings.finish,
    videoOpen,
    volume: music.volume,
    current: progress.current,
    duration: progress.duration,
  };
  const rows = podRows(view);

  /** A control the viewer touched: it lights the screen, then acts. */
  const touch =
    <Args extends unknown[]>(toAction: (...args: Args) => PodAction) =>
    (...args: Args) => {
      backlight.wake();
      dispatch(toAction(...args));
    };

  return {
    state,
    rows,
    description: describePod(state, rows, view),
    lit: backlight.lit,
    /** Counts as a touch, for the backlight. */
    wake: backlight.wake,
    canGoBack:
      videoOpen || (!videoCovers && parentScreen[state.screen] !== null),
    controls: {
      step: touch((steps: number) => ({ type: "step", steps })),
      select: touch(() => ({ type: "select" })),
      back: touch(() => ({ type: "back" })),
      next: touch(() => ({ type: "next" })),
      previous: touch(() => ({ type: "previous" })),
      playPause: touch(() => ({ type: "playPause" })),
      pick: touch((screen: ChoiceScreen, index: number) => ({
        type: "pick",
        screen,
        index,
      })),
      hover: (screen: ChoiceScreen, index: number) =>
        dispatch({ type: "hover", screen, index }),
      scrubTo: touch((fraction: number, done: boolean) => ({
        type: "scrubTo",
        fraction,
        done,
      })),
      volumeTo: touch((fraction: number, done: boolean) => ({
        type: "volumeTo",
        fraction,
        done,
      })),
      toggleHold: touch(() => ({ type: "toggleHold" })),
    },
  };
}

export type Pod = ReturnType<typeof usePod>;
