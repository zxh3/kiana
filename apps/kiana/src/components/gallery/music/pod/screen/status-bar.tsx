import { cx } from "../../../../../lib/class-names";
import type { BatteryState } from "../use-battery";
import {
  BatteryGlyph,
  LockGlyph,
  type PlayState,
  PlayStateGlyph,
} from "./glyphs";

const bar =
  "relative flex h-[18px] w-full shrink-0 items-center justify-center border-b border-[#8e8e8e] bg-[linear-gradient(180deg,#fefefe_0%,#e4e4e4_55%,#cdcdcd_100%)] px-1.5 outline-none";

/**
 * The grey title bar: play state and hold on the left, battery right. When
 * there is somewhere to go back to, a chevron shows before the title and a
 * tap on the bar goes back, like Menu.
 */
export function StatusBar({
  battery,
  held,
  onBack,
  state,
  title,
}: {
  battery: BatteryState | null;
  held: boolean;
  /** Set when there is somewhere to go back to. */
  onBack?: () => void;
  state: PlayState;
  title: string;
}) {
  const content = (
    <>
      <span className="absolute left-1.5 flex items-center gap-1">
        <PlayStateGlyph state={state} />
        {held ? <LockGlyph /> : null}
      </span>
      <span className="flex items-center gap-1 text-[11px] leading-none font-bold text-[#1b1b1b]">
        {onBack ? (
          <span
            aria-hidden="true"
            className="-mt-px text-[13px] text-[#6d6d6d]"
          >
            ‹
          </span>
        ) : null}
        {title}
      </span>
      <span
        className="absolute right-1.5 flex"
        title={
          battery
            ? `Battery ${Math.round(battery.level * 100)}%${battery.charging ? ", charging" : ""}`
            : undefined
        }
      >
        <BatteryGlyph battery={battery} />
      </span>
    </>
  );
  if (!onBack) return <div className={bar}>{content}</div>;
  return (
    <button
      aria-label={`Back from ${title}`}
      className={cx(bar, "cursor-pointer focus-visible:bg-[#d8e6f8]")}
      onClick={onBack}
      type="button"
    >
      {content}
    </button>
  );
}
