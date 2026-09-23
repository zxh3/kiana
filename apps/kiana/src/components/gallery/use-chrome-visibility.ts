import { useCallback, useEffect, useRef, useState } from "react";

const IDLE_TIMEOUT = 2_800;

/**
 * Controls appear on pointer movement or key presses and fade after a quiet
 * moment. `hold` keeps them up while a menu is open or they have focus. A
 * click-through wallpaper never receives events, so it stays clean.
 */
export function useChromeVisibility(hold: boolean) {
  const [awake, setAwake] = useState(false);
  const timer = useRef<number>(undefined);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  const wake = useCallback((duration = IDLE_TIMEOUT) => {
    setAwake(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAwake(false), duration);
  }, []);

  const sleep = useCallback(() => {
    window.clearTimeout(timer.current);
    setAwake(false);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const last = lastPointer.current;
      lastPointer.current = { x: event.clientX, y: event.clientY };
      if (
        last &&
        Math.abs(last.x - event.clientX) + Math.abs(last.y - event.clientY) < 4
      ) {
        return;
      }
      wake();
    };
    const handleKeyDown = () => wake();

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(timer.current);
    };
  }, [wake]);

  return { visible: awake || hold, wake, sleep };
}
