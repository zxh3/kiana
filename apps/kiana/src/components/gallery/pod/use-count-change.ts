import { useEffect, useRef } from "react";

/**
 * Calls `onChange` with how far `count` moved, each time it moves. The
 * player counts up what the wheel does on an app's screen, and the screen
 * acts only on what happens while it shows, so the count it opens on is
 * old news. `onChange` is the latest one passed.
 */
export function useCountChange(
  count: number,
  onChange: (moved: number) => void,
) {
  const seen = useRef(count);
  const handler = useRef(onChange);
  handler.current = onChange;
  useEffect(() => {
    const moved = count - seen.current;
    seen.current = count;
    if (moved !== 0) handler.current(moved);
  }, [count]);
}
