import { parseFlagOn, useStoredState } from "../use-stored-state";
import { parseKianaFace, parseSpinnerStyle } from "./apps/spinner/spinner";
import { type Finish, parseFinish } from "./device/finishes";

export type Backlight = "timed" | "always";

export const backlightLabels: Record<Backlight, string> = {
  timed: "10 Seconds",
  always: "Always On",
};

/** How long the screen stays lit after the last touch, as on the original. */
export const BACKLIGHT_TIMEOUT = 10_000;

export function parseBacklight(raw: string | null): Backlight {
  return raw === "always" ? "always" : "timed";
}

/** The device's own settings, kept between visits like the real one's. */
export function usePodSettings() {
  const [finish, setFinish] = useStoredState<Finish>(
    "kiana.music-finish",
    parseFinish,
  );
  const [backlight, setBacklight] = useStoredState(
    "kiana.music-backlight",
    parseBacklight,
  );
  const [clicker, setClicker] = useStoredState(
    "kiana.music-clicker",
    parseFlagOn,
  );
  // The finger spinner's looks, chosen under Settings like the finish.
  const [spinner, setSpinner] = useStoredState(
    "kiana.spinner-style",
    parseSpinnerStyle,
  );
  const [face, setFace] = useStoredState("kiana.spinner-face", parseKianaFace);
  return {
    backlight,
    clicker,
    face,
    finish,
    setBacklight,
    setClicker,
    setFace,
    setFinish,
    setSpinner,
    spinner,
  };
}

export type PodSettings = ReturnType<typeof usePodSettings>;
