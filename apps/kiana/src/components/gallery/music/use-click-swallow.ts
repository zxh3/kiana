import { type MouseEvent, useCallback, useRef } from "react";

/**
 * Stops the click that a browser sends after a gesture which was not meant
 * as a click: a drag, a swipe, a turn of the wheel, or a tap that only woke
 * the screen. `arm` when the gesture turns out not to be a click; the next
 * click is swallowed. Every new press calls `disarm`, so a gesture that ends
 * without a click never eats a later one.
 */
export function useClickSwallow() {
  const armed = useRef(false);
  const arm = useCallback(() => {
    armed.current = true;
  }, []);
  const disarm = useCallback(() => {
    armed.current = false;
  }, []);
  const onClickCapture = useCallback((event: MouseEvent) => {
    if (!armed.current) return;
    armed.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);
  return { arm, disarm, onClickCapture };
}
