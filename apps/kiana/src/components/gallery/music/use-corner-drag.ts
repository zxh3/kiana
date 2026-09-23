import {
  type MouseEvent,
  type PointerEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { type Corner, nearestCorner } from "./music-layout";

const DRAG_THRESHOLD = 6;
const SNAP_TRANSITION = "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Drag an element anywhere; on release it glides to the nearest corner.
 * Buttons stay tappable: a press only becomes a drag after a few pixels of
 * movement, and the click that ends a drag is swallowed. Sliders, links,
 * and embedded frames never start a drag.
 */
export function useCornerDrag<T extends HTMLElement>({
  corner,
  handle,
  onCornerChange,
}: {
  corner: Corner;
  /** When set, only a press inside an element matching this selector drags. */
  handle?: string;
  onCornerChange: (corner: Corner) => void;
}) {
  const ref = useRef<T>(null);
  const press = useRef<{
    id: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const swallowClick = useRef(false);
  const snapFrom = useRef<DOMRect | null>(null);
  const [snaps, setSnaps] = useState(0);
  const [dragging, setDragging] = useState(false);

  // FLIP: start from where the card was dropped, glide into the corner.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs after each snap
  useLayoutEffect(() => {
    const element = ref.current;
    const from = snapFrom.current;
    if (!element || !from) return;
    snapFrom.current = null;
    element.style.transition = "none";
    element.style.transform = "";
    const to = element.getBoundingClientRect();
    element.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px)`;
    element.getBoundingClientRect();
    element.style.transition = SNAP_TRANSITION;
    element.style.transform = "";
    const settle = () => {
      element.style.transition = "";
    };
    element.addEventListener("transitionend", settle, { once: true });
  }, [corner, snaps]);

  const onPointerDown = (event: PointerEvent<T>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (handle && !target.closest(handle)) return;
    if (target.closest("input, a, iframe")) return;
    press.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<T>) => {
    const current = press.current;
    const element = ref.current;
    if (!current || !element || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      current.moved = true;
      // Capture only once it is a drag, so plain taps still click buttons.
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // The pointer is already gone; the drag still follows move events.
      }
      setDragging(true);
    }
    element.style.transition = "none";
    element.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const finish = (event: PointerEvent<T>, cancelled: boolean) => {
    const current = press.current;
    const element = ref.current;
    press.current = null;
    if (!current || !element || current.id !== event.pointerId) return;
    if (!current.moved) return;
    setDragging(false);
    swallowClick.current = true;
    window.setTimeout(() => {
      swallowClick.current = false;
    }, 0);
    const rect = element.getBoundingClientRect();
    snapFrom.current = rect;
    if (!cancelled) {
      onCornerChange(
        nearestCorner(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          window.innerWidth,
          window.innerHeight,
        ),
      );
    }
    setSnaps((count) => count + 1);
  };

  const onClickCapture = (event: MouseEvent<T>) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return {
    dragging,
    handlers: {
      onClickCapture,
      onPointerCancel: (event: PointerEvent<T>) => finish(event, true),
      onPointerDown,
      onPointerMove,
      onPointerUp: (event: PointerEvent<T>) => finish(event, false),
    },
    ref,
  };
}
