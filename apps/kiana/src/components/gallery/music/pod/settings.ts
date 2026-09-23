import { useStoredState } from "../../use-stored-state";
import { type Finish, parseFinish } from "./finishes";

export const backlights = ["timed", "always"] as const;
export type Backlight = (typeof backlights)[number];

export const backlightLabels: Record<Backlight, string> = {
  timed: "10 Seconds",
  always: "Always On",
};

/** How long the screen stays lit after the last touch, as on the original. */
export const BACKLIGHT_TIMEOUT = 10_000;

export function parseBacklight(raw: string | null): Backlight {
  return raw === "always" ? "always" : "timed";
}

/** The wheel clicks unless the clicker was turned off. */
export function parseClicker(raw: string | null) {
  return raw !== "false";
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
    parseClicker,
  );
  return {
    backlight,
    clicker,
    finish,
    setBacklight,
    setClicker,
    setFinish,
  };
}

export type PodSettings = ReturnType<typeof usePodSettings>;
