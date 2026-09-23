import { useState } from "react";

import { cx } from "../../../../../lib/class-names";
import { scrollWindow, VISIBLE_ROWS } from "../menu";
import type { PodRow } from "../rows";
import { useSwipeSteps } from "../use-swipe-steps";
import { SpeakerGlyph } from "./glyphs";

const ROW_HEIGHT = 19;

/** The glossy two-tone highlight of the selected row. */
const highlight =
  "bg-[linear-gradient(180deg,#72b3f9_0%,#4390ee_48%,#2d7ae3_52%,#3584ea_100%)] text-white [text-shadow:0_-1px_0_rgb(0_0_0/.18)]";

/**
 * A menu list. The wheel moves the highlight and the centre button picks
 * the row; on the touch screen a drag up or down moves the highlight and a
 * tap picks the row, and with a mouse the highlight follows the pointer.
 */
export function PodList({
  label,
  onHover,
  onPick,
  onStep,
  rows,
  selected,
}: {
  label: string;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
  onStep: (steps: number) => void;
  rows: ReadonlyArray<PodRow>;
  selected: number;
}) {
  // The window scrolls only when the highlight would leave it, so it is
  // worked out from the last window, adjusting state during render.
  const [first, setFirst] = useState(0);
  const start = scrollWindow(first, selected, rows.length);
  if (start !== first) setFirst(start);
  const scrolls = rows.length > VISIBLE_ROWS;
  const swipe = useSwipeSteps<HTMLDivElement>({
    axis: "y",
    onStep,
    size: ROW_HEIGHT,
  });

  return (
    <div {...swipe} className="relative h-full touch-none overflow-hidden">
      <ol
        aria-label={label}
        className="transition-transform duration-100 ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(${-start * ROW_HEIGHT}px)` }}
      >
        {rows.map((row, index) => {
          const active = index === selected;
          return (
            <li key={row.key}>
              <button
                aria-current={active || undefined}
                className={cx(
                  "flex w-full cursor-pointer items-center gap-1.5 pr-1.5 pl-2 text-left text-[12px] leading-none outline-none",
                  scrolls && "pr-3",
                  active ? highlight : "text-[#141414]",
                )}
                onClick={() => onPick(index)}
                onPointerMove={(event) => {
                  if (event.pointerType === "mouse" && !active) onHover(index);
                }}
                style={{ height: ROW_HEIGHT }}
                // For pointers; from the keyboard the wheel drives the display.
                tabIndex={-1}
                type="button"
              >
                <span
                  className="min-w-0 flex-1 truncate font-semibold"
                  lang={row.lang}
                >
                  {row.label}
                </span>
                {row.current ? (
                  <SpeakerGlyph
                    className={active ? "text-white" : "text-[#2d7ae3]"}
                  />
                ) : null}
                {row.detail ? (
                  <span
                    className={cx(
                      "shrink-0 text-[11px]",
                      active ? "text-white/90" : "text-[#6d6d6d]",
                    )}
                  >
                    {row.detail}
                  </span>
                ) : null}
                {row.opens ? (
                  <span
                    aria-hidden="true"
                    className={cx(
                      "-mt-px shrink-0 text-[13px] font-bold",
                      active ? "text-white" : "text-[#9a9a9a]",
                    )}
                  >
                    ›
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
      {scrolls ? (
        <div className="absolute inset-y-0 right-0 w-[7px] border-l border-[#bdbdbd] bg-[linear-gradient(90deg,#e9e9e9,#fbfbfb)]">
          <div
            className="absolute inset-x-[1px] rounded-[2px] bg-[linear-gradient(90deg,#7fb6f5,#3584ea)]"
            style={{
              top: `${(start / rows.length) * 100}%`,
              height: `${(VISIBLE_ROWS / rows.length) * 100}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
