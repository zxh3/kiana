import { motion } from "motion/react";

import { cx } from "../../lib/class-names";
import { springs } from "../../lib/motion";
import { focusRing } from "./control-button";

/**
 * The years down the right of a grid of photos by month, the one in view
 * marked, each jumping to its first row. Nothing for a single year.
 */
export function YearRail({
  activeYear,
  anchors,
  compact,
  layoutId,
  onJump,
}: {
  activeYear: number | undefined;
  anchors: ReadonlyArray<{ year: number; row: number }>;
  compact: boolean;
  /** Names the sliding marker, unique per grid. */
  layoutId: string;
  onJump: (row: number) => void;
}) {
  if (anchors.length < 2) return null;
  return (
    <nav
      aria-label="Jump to a year"
      className="absolute top-1/2 right-1 z-10 flex -translate-y-1/2 flex-col items-end gap-0.5 sm:right-5"
    >
      {anchors.map(({ year, row }) => (
        <button
          aria-current={year === activeYear ? "true" : undefined}
          className={cx(
            "relative isolate cursor-pointer rounded-full px-2 py-1.5 text-[10px] tabular-nums tracking-[.08em] transition-colors duration-200 sm:px-2.5",
            year === activeYear ? "text-ink" : "text-paper/40 hover:text-paper",
            focusRing,
            "focus-visible:ring-offset-0",
          )}
          key={year}
          onClick={() => onJump(row)}
          title={`Jump to ${year}`}
          type="button"
        >
          {/* The current year's marker glides along as you scroll. */}
          {year === activeYear ? (
            <motion.span
              className="absolute inset-0 -z-10 rounded-full bg-paper"
              layoutId={layoutId}
              transition={springs.gentle}
            />
          ) : null}
          {compact ? `’${String(year).slice(2)}` : year}
        </button>
      ))}
    </nav>
  );
}
