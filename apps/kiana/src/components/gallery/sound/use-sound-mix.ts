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
  const [videoVolume, setVideoVolume] = useStoredState(
    VIDEO_VOLUME_KEY,
    parseLevel,
  );
  const [interfaceOn, saveInterfaceOn] = useStoredState(
    INTERFACE_KEY,
    parseFlagOn,
  );
  const [interfaceVolume, setInterfaceVolume] = useStoredState(
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

  return {
    videos: {
      on: videosOn,
      setOn: setVideosOn,
      volume: videoVolume,
      setVolume: setVideoVolume,
    },
    interface: {
      /** Null where the browser cannot play generated sound. */
      supported: soundsSupported(),
      on: interfaceOn,
      setOn: setInterfaceOn,
      volume: interfaceVolume,
      setVolume: setInterfaceVolume,
    },
  };
}

export type SoundMix = ReturnType<typeof useSoundMix>;
