import { cx } from "../../lib/class-names";
import { type Frame, frames } from "./model";

export function FramePicker({
  frame,
  onPick,
}: {
  frame: Frame;
  onPick: (frame: Frame) => void;
}) {
  return (
    <div className="group/picker absolute bottom-0 left-1/2 z-6 h-[170px] w-[min(100vw,560px)] -translate-x-1/2">
      <fieldset
        aria-label="Photo frame"
        className="pointer-events-none absolute bottom-[76px] left-1/2 m-0 flex -translate-x-1/2 gap-1 rounded-full border border-[rgba(246,240,230,.08)] bg-[rgba(23,18,15,.5)] p-1.5 opacity-0 shadow-[0_12px_36px_rgba(0,0,0,.16)] backdrop-blur-2xl transition-opacity delay-150 duration-850 ease-[cubic-bezier(.22,1,.36,1)] group-hover/picker:pointer-events-auto group-hover/picker:opacity-100 group-hover/picker:delay-0 group-hover/picker:duration-500 group-focus-within/picker:pointer-events-auto group-focus-within/picker:opacity-100 group-focus-within/picker:delay-0 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100 [@media(pointer:coarse)]:delay-0 motion-reduce:transition-none max-sm:bottom-[calc(80px+env(safe-area-inset-bottom))] max-sm:gap-0.5 max-sm:p-[5px]"
      >
        {frames.map((option, index) => (
          <button
            aria-keyshortcuts={String(index + 1)}
            aria-pressed={frame === option}
            className={cx(
              "min-w-[104px] touch-manipulation cursor-pointer rounded-full border-0 bg-transparent px-4 py-[9px] text-[9px] leading-none font-normal tracking-[.22em] text-[rgba(246,240,230,.58)] uppercase indent-[.22em] outline-none transition-[color,background-color] duration-200 hover:text-[#f6f0e6] focus-visible:text-[#f6f0e6] focus-visible:shadow-[inset_0_0_0_1px_rgba(246,240,230,.65)] max-sm:min-h-10.5 max-sm:min-w-[86px] max-sm:px-2.5 max-sm:py-0 max-sm:text-[8px] max-sm:tracking-[.16em] max-sm:indent-[.16em]",
              frame === option && "bg-[#a89e92] text-[#17120f]",
            )}
            key={option}
            onClick={(event) => {
              event.stopPropagation();
              onPick(option);
            }}
            type="button"
            title={`${option} (${index + 1})`}
          >
            {option}
          </button>
        ))}
      </fieldset>
    </div>
  );
}
