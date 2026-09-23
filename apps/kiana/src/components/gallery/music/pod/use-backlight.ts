import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The screen's backlight: lit while in use, dimming `timeout` ms after the
 * last touch unless it is set to stay on. `wake` counts as a touch; `dim`
 * turns it off now, as holding Menu does.
 */
export function useBacklight(timeout: number | null) {
  const [lit, setLit] = useState(true);
  const timer = useRef<number>(undefined);

  const wake = useCallback(() => {
    setLit(true);
    window.clearTimeout(timer.current);
    if (timeout !== null) {
      timer.current = window.setTimeout(() => setLit(false), timeout);
    }
  }, [timeout]);

  const dim = useCallback(() => {
    window.clearTimeout(timer.current);
    setLit(false);
  }, []);

  useEffect(() => {
    wake();
    return () => window.clearTimeout(timer.current);
  }, [wake]);

  return { dim, lit, wake };
}
