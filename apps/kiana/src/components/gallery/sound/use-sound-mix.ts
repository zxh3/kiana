import { useCallback, useEffect, useState } from "react";

import {
  cue,
  setSoundsEnabled,
  setSoundsVolume,
  soundsSupported,
} from "../../../lib/sounds";
import { parseFlagOn, parseLevel, useStoredState } from "../use-stored-state";

const VIDEO_VOLUME_KEY = "kiana.clip-volume";
const INTERFACE_KEY = "kiana.ui-sounds";
const INTERFACE_VOLUME_KEY = "kiana.ui-volume";

/**
 * The page's own sound channels; music keeps its own in `useMusic`.
 * - Videos: Live Photos and videos. Off at the start of every visit, since
 *   browsers only autoplay video without sound; the level is kept.
 * - Interface: the generated clicks and chimes, on by default, kept.
 * Each channel has a switch (whether it is heard) and a level (how loud).
 */
export function useSoundMix() {
  const [videosOn, setVideosOn] = useState(false);
  const [videoVolume, saveVideoVolume] = useStoredState(
    VIDEO_VOLUME_KEY,
    parseLevel,
  );
  const [interfaceOn, saveInterfaceOn] = useStoredState(
    INTERFACE_KEY,
    parseFlagOn,
  );
  const [interfaceVolume, saveInterfaceVolume] = useStoredState(
    INTERFACE_VOLUME_KEY,
    parseLevel,
  );

  useEffect(() => {
    setSoundsEnabled(interfaceOn);
  }, [interfaceOn]);
  useEffect(() => {
    setSoundsVolume(interfaceVolume / 100);
  }, [interfaceVolume]);

  /** Turning interface sounds on plays the first; off plays the last. */
  const setInterfaceOn = useCallback(
    (on: boolean) => {
      if (on) setSoundsEnabled(true);
      cue(on ? "switchOn" : "switchOff");
      if (!on) setSoundsEnabled(false);
      saveInterfaceOn(on);
    },
    [saveInterfaceOn],
  );

  /** The videos' switch, from the mixer or the M key, sounds as it turns. */
  const setVideosHeard = useCallback((on: boolean) => {
    cue(on ? "switchOn" : "switchOff");
    setVideosOn(on);
  }, []);

  // Moving a channel's slider while it is off turns it on: the videos
  // quietly, the interface with its switch's sound, as a turn of it would.
  const setVideoVolume = useCallback(
    (volume: number) => {
      saveVideoVolume(volume);
      if (!videosOn) setVideosOn(true);
    },
    [saveVideoVolume, videosOn],
  );
  const setInterfaceVolume = useCallback(
    (volume: number) => {
      saveInterfaceVolume(volume);
      if (!interfaceOn) setInterfaceOn(true);
    },
    [interfaceOn, saveInterfaceVolume, setInterfaceOn],
  );

  return {
    videos: {
      on: videosOn,
      setOn: setVideosHeard,
      volume: videoVolume,
      setVolume: setVideoVolume,
    },
    interface: {
      /** Whether the browser can play generated sound at all. */
      supported: soundsSupported(),
      on: interfaceOn,
      setOn: setInterfaceOn,
      volume: interfaceVolume,
      setVolume: setInterfaceVolume,
    },
  };
}

export type SoundMix = ReturnType<typeof useSoundMix>;
