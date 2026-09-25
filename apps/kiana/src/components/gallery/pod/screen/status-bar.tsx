import { cx } from "../../../../lib/class-names";
import { HapticTap } from "../../haptic-tap";
import { STATUS_BAR_HEIGHT } from "../device/geometry";
import type { BatteryState } from "../use-battery";
import {
  BackGlyph,
  BatteryGlyph,
  LockGlyph,
  type PlayState,
  PlayStateGlyph,
} from "./glyphs";

const bar =
  "relative flex w-full shrink-0 items-center justify-center border-b border-[#8e8e8e] bg-[linear-gradient(180deg,#fefefe_0%,#e4e4e4_55%,#cdcdcd_100%)] px-1.5 outline-none";

/**
 * The grey title bar. The left is for navigation only: a back chevron when
 * there is somewhere to go back to, and a tap anywhere on the bar goes
 * back, like Menu. What the player is doing sits on the right with the
 * battery: hold, then play or pause.
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
      {onBack ? (
        <span className="absolute left-1.5 flex">
          <BackGlyph />
        </span>
      ) : null}
      <span className="text-[11px] leading-none font-bold text-[#1b1b1b]">
        {title}
      </span>
      <span
        className="absolute right-1.5 flex items-center gap-1"
        title={
          battery
            ? `Battery ${Math.round(battery.level * 100)}%${battery.charging ? ", charging" : ""}`
            : undefined
        }
      >
        {held ? <LockGlyph /> : null}
        <PlayStateGlyph state={state} />
        <BatteryGlyph battery={battery} />
      </span>
    </>
  );
  const style = { height: STATUS_BAR_HEIGHT };
  if (!onBack) {
    return (
      <div className={bar} style={style}>
        {content}
      </div>
    );
  }
  return (
    <button
      aria-label={`Back from ${title}`}
      className={cx(bar, "cursor-pointer")}
      onClick={onBack}
      style={style}
      // For pointers; from the keyboard, Menu or Escape goes back.
      tabIndex={-1}
      type="button"
    >
      {content}
      <HapticTap />
    </button>
  );
}
