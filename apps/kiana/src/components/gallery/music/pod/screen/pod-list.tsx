import { useRef } from "react";

import { cx } from "../../../../../lib/class-names";
import { scrollWindow, VISIBLE_ROWS } from "../menu";
import { SpeakerGlyph } from "./glyphs";

const ROW_HEIGHT = 19;

/** The glossy two-tone highlight of the selected row. */
const highlight =
  "bg-[linear-gradient(180deg,#72b3f9_0%,#4390ee_48%,#2d7ae3_52%,#3584ea_100%)] text-white [text-shadow:0_-1px_0_rgb(0_0_0/.18)]";

export type PodRow = {
  key: string;
  label: string;
  /** A setting's current value, written on the right. */
  detail?: string;
  /** Opens another screen. */
  opens?: boolean;
  /** The song that is playing. */
  current?: boolean;
  lang?: string;
};

/**
 * A menu list. Like the rest of the screen it only shows: the wheel moves
 * the highlight and the centre button picks the row.
 */
export function PodList({
  label,
  rows,
  selected,
}: {
  label: string;
  rows: ReadonlyArray<PodRow>;
  selected: number;
}) {
  // The window scrolls only when the highlight would leave it; recomputing
  // it from the last window during render keeps it in step with the wheel.
  const first = useRef(0);
  first.current = scrollWindow(first.current, selected, rows.length);
  const scrolls = rows.length > VISIBLE_ROWS;

  return (
    <div className="relative h-full overflow-hidden">
      <ol
        aria-label={label}
        className="transition-transform duration-100 ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(${-first.current * ROW_HEIGHT}px)` }}
      >
        {rows.map((row, index) => {
          const active = index === selected;
          return (
            <li aria-current={active || undefined} key={row.key}>
              <div
                className={cx(
                  "flex w-full items-center gap-1.5 pr-1.5 pl-2 text-left text-[12px] leading-none outline-none",
                  scrolls && "pr-3",
                  active ? highlight : "text-[#141414]",
                )}
                style={{ height: ROW_HEIGHT }}
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
              </div>
            </li>
          );
        })}
      </ol>
      {scrolls ? (
        <div className="absolute inset-y-0 right-0 w-[7px] border-l border-[#bdbdbd] bg-[linear-gradient(90deg,#e9e9e9,#fbfbfb)]">
          <div
            className="absolute inset-x-[1px] rounded-[2px] bg-[linear-gradient(90deg,#7fb6f5,#3584ea)]"
            style={{
              top: `${(first.current / rows.length) * 100}%`,
              height: `${(VISIBLE_ROWS / rows.length) * 100}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
