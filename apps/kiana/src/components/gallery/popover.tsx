import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from "react";

import { cx } from "../../lib/class-names";

export type PopoverTriggerProps = {
  "aria-controls": string;
  "aria-expanded": boolean;
  "aria-haspopup": "menu" | "dialog";
  onClick: () => void;
  ref: RefObject<HTMLButtonElement | null>;
};

const placements = {
  "bottom-start": "top-[calc(100%+10px)] left-0 origin-top-left",
  "top-end": "right-0 bottom-[calc(100%+12px)] origin-bottom-right",
  "top-center":
    "bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 origin-bottom",
};

const FOCUSABLE = "button:not(:disabled)";

/**
 * A small anchored panel. It closes on Escape or an outside press, returns
 * focus to its trigger, and moves focus between its buttons with arrow keys.
 */
export function Popover({
  children,
  className,
  kind,
  label,
  onOpenChange,
  open,
  placement,
  trigger,
}: {
  children: ReactNode;
  className?: string;
  kind: "menu" | "dialog";
  label: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  placement: keyof typeof placements;
  trigger: (props: PopoverTriggerProps) => ReactNode;
}) {
  const id = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Parents re-render often (video progress, slide changes); keep the latest
  // callback without re-running the open/close setup, which moves focus.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const preferred =
      panel.querySelector<HTMLElement>(
        '[aria-checked="true"], [aria-pressed="true"]',
      ) ?? panel.querySelector<HTMLElement>(FOCUSABLE);
    preferred?.focus({ preventScroll: true });

    const moveFocus = (event: globalThis.KeyboardEvent) => {
      const step =
        event.key === "ArrowDown" || event.key === "ArrowRight"
          ? 1
          : event.key === "ArrowUp" || event.key === "ArrowLeft"
            ? -1
            : 0;
      if (!step) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const position = items.indexOf(document.activeElement as HTMLElement);
      const next = items[(position + step + items.length) % items.length];
      if (!next) return;
      event.preventDefault();
      next.focus();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        onOpenChangeRef.current(false);
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onOpenChangeRef.current(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    panel.addEventListener("keydown", moveFocus);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      panel.removeEventListener("keydown", moveFocus);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  const panelProps = {
    "aria-label": label,
    className: cx(
      "glass absolute z-40 rounded-[22px] bg-night/80 p-2 text-paper transition-[opacity,scale] duration-200 ease-soft starting:scale-96 starting:opacity-0",
      placements[placement],
      className,
    ),
    id,
    ref: panelRef,
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {trigger({
        "aria-controls": id,
        "aria-expanded": open,
        "aria-haspopup": kind,
        onClick: () => onOpenChange(!open),
        ref: triggerRef,
      })}
      {open && kind === "menu" ? (
        <div role="menu" {...panelProps}>
          {children}
        </div>
      ) : null}
      {open && kind === "dialog" ? (
        <div role="dialog" {...panelProps}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
