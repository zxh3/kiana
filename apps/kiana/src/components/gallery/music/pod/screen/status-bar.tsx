import type { BatteryState } from "../use-battery";
import {
  BatteryGlyph,
  LockGlyph,
  type PlayState,
  PlayStateGlyph,
} from "./glyphs";

/** The grey title bar: play state and hold on the left, battery right. */
export function StatusBar({
  battery,
  held,
  state,
  title,
}: {
  battery: BatteryState | null;
  held: boolean;
  state: PlayState;
  title: string;
}) {
  return (
    <div className="relative flex h-[18px] shrink-0 items-center justify-center border-b border-[#8e8e8e] bg-[linear-gradient(180deg,#fefefe_0%,#e4e4e4_55%,#cdcdcd_100%)] px-1.5">
      <span className="absolute left-1.5 flex items-center gap-1">
        <PlayStateGlyph state={state} />
        {held ? <LockGlyph /> : null}
      </span>
      <span className="text-[11px] leading-none font-bold text-[#1b1b1b]">
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
    </div>
  );
}
