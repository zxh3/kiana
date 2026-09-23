import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

import { cx } from "../../lib/class-names";

const shortcutNames: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
};

export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-paper/80 focus-visible:ring-offset-2 focus-visible:ring-offset-night";

export function ControlButton({
  children,
  className,
  label,
  ref,
  shortcut,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  label: string;
  ref?: Ref<HTMLButtonElement>;
  shortcut?: string;
}) {
  return (
    <button
      aria-keyshortcuts={shortcut}
      aria-label={label}
      className={cx(
        "grid size-10 shrink-0 cursor-pointer touch-manipulation place-items-center rounded-full text-paper/72 transition-[color,background-color,scale] duration-200 ease-soft hover:bg-paper/10 hover:text-paper active:scale-92 disabled:pointer-events-none disabled:opacity-28",
        focusRing,
        className,
      )}
      ref={ref}
      title={
        shortcut ? `${label} (${shortcutNames[shortcut] ?? shortcut})` : label
      }
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
