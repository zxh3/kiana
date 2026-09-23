import {
  type FocusEvent,
  type PointerEvent,
  useCallback,
  useMemo,
  useState,
} from "react";

export type ChromeHoldProps = {
  onBlur: (event: FocusEvent<HTMLElement>) => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
};

/**
 * Keeps controls visible while a mouse rests on them or keyboard focus is
 * inside them, so they never fade out from under someone using them.
 */
export function useChromeHold() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const onPointerEnter = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") setHovered(true);
  }, []);
  const onPointerLeave = useCallback(() => setHovered(false), []);
  const onFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    setFocused(event.target.matches(":focus-visible"));
  }, []);
  const onBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFocused(false);
    }
  }, []);

  const holdProps = useMemo(
    () => ({ onBlur, onFocus, onPointerEnter, onPointerLeave }),
    [onBlur, onFocus, onPointerEnter, onPointerLeave],
  );
  return { held: hovered || focused, holdProps };
}
