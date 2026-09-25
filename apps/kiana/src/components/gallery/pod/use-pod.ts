import { useCallback, useEffect, useRef, useState } from "react";

import { tap } from "../../../lib/haptics";
import { cue } from "../../../lib/sounds";
import type { Music } from "../music/use-music";
import { useAccount } from "../use-account";
import { otherPeople } from "./apps/chat/chat";
import { useChat } from "./apps/chat/use-chat";
import { useMuyu } from "./apps/muyu/use-muyu";
import { nextKianaFace, nextSpinnerStyle } from "./apps/spinner/spinner";
import { nextFinish } from "./device/finishes";
import type { HoldZone } from "./device/wheel";
import {
  initialPodState,
  LOCK_SHOWS_FOR,
  overlayDurations,
  type PodAction,
  type PodContext,
  type PodEffect,
  podReducer,
  SEEK_SETTLE,
  SEEK_TICK,
} from "./machine";
import { type ChoiceScreen, screens, type ToggleSetting } from "./menu";
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
  const account = useAccount();
  // A live app stays connected while one of its screens shows.
  const { room } = screens[state.screen];
  const chat = useChat(room === "chat", account.member);
  const muyu = useMuyu(room === "muyu", account.member?.id ?? null);
  const others = otherPeople(chat);

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
    online: others.length + 1,
    account: account.status,
  };

  // What a press on each setting does: the next value, in place.
  const toggleSetting: Record<ToggleSetting, () => void> = {
    shuffle: () => music.setShuffle(!music.shuffle),
    repeat: () => music.setRepeat(music.repeat === "one" ? "all" : "one"),
    backlight: () =>
      settings.setBacklight(
        settings.backlight === "timed" ? "always" : "timed",
      ),
    clicker: () => settings.setClicker(!settings.clicker),
    finish: () => settings.setFinish(nextFinish(settings.finish)),
    spinner: () => settings.setSpinner(nextSpinnerStyle(settings.spinner)),
    face: () => settings.setFace(nextKianaFace(settings.face)),
  };

  const run = (effect: PodEffect) => {
    switch (effect.type) {
      // Every sound the player makes is also a tap, so the wheel's clicks
      // can be felt, and turning off the clicker stops both. Android taps
      // anywhere; iPhones only while a finger is on the wheel, and
      // `HapticTap` covers their presses of the other buttons.
      case "cue":
        cue(effect.cue);
        tap();
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
      case "pause":
        music.pause();
        break;
      case "backlight":
        if (backlight.lit) backlight.dim();
        else backlight.wake();
        break;
      case "setting":
        toggleSetting[effect.item]();
        break;
      case "video":
        onVideoChange(effect.on);
        break;
      case "say":
        chat.say(effect.text);
        break;
      case "rename":
        chat.rename(effect.name);
        break;
      case "pat":
        muyu.pat();
        break;
      case "signIn":
        account.signIn();
        break;
      case "signOut":
        account.signOut();
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

  // A held ⏮ or ⏭ moves the scrubber until it is let go.
  useEffect(() => {
    if (state.seeking === 0) return;
    const timer = window.setInterval(
      () => dispatch({ type: "seekTick" }),
      SEEK_TICK,
    );
    return () => window.clearInterval(timer);
  }, [dispatch, state.seeking]);

  const view: PodView = {
    playlist: music.playlist,
    index: music.index,
    shuffle: music.shuffle,
    repeat: music.repeat,
    backlight: settings.backlight,
    clicker: settings.clicker,
    finish: settings.finish,
    spinner: settings.spinner,
    face: settings.face,
    account: { status: account.status, member: account.member },
    chat: {
      name: chat.name,
      status: chat.status,
      others,
      last: chat.messages.at(-1),
    },
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
    /** The finger spinner's looks, chosen in Settings. */
    looks: { spinner: settings.spinner, face: settings.face },
    /** The Chat Room's connection, messages, and who is here. */
    chat,
    /** The electronic wooden fish's merit, everyone's and the viewer's. */
    muyu,
    /** Counts as a touch, for the backlight. */
    wake: backlight.wake,
    canGoBack:
      videoOpen || (!videoCovers && screens[state.screen].parent !== null),
    controls: {
      step: touch((steps: number) => ({ type: "step", steps })),
      select: touch(() => ({ type: "select" })),
      back: touch(() => ({ type: "back" })),
      next: touch(() => ({ type: "next" })),
      previous: touch(() => ({ type: "previous" })),
      playPause: touch(() => ({ type: "playPause" })),
      toggleVideo: touch(() => ({ type: "toggleVideo" })),
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
      say: touch((text: string) => ({ type: "say", text })),
      saveName: touch((name: string) => ({ type: "saveName", name })),
      // Holding Menu toggles the backlight itself, so it does not wake it.
      holdStart: (zone: HoldZone) => {
        if (zone !== "menu") backlight.wake();
        dispatch({ type: "holdStart", zone });
      },
      holdEnd: (zone: HoldZone) => dispatch({ type: "holdEnd", zone }),
    },
  };
}

export type Pod = ReturnType<typeof usePod>;
