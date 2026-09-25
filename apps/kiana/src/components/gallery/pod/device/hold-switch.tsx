import { cx } from "../../../../lib/class-names";
import { HapticTap } from "../../haptic-tap";
import { BODY_PADDING, CORNER_CLEARANCE } from "./geometry";

/**
 * The hold switch, set into the aluminium above the screen's left corner,
 * opposite the minimize and close dimples: a shallow slot with a knob of
 * the body's own metal. Sliding it on uncovers an orange strip, as on the
 * original, and locks every control on the wheel and the screen.
 */
export function HoldSwitch({
  held,
  onToggle,
}: {
  held: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-label="Hold"
      aria-pressed={held}
      className="group/hold absolute flex cursor-pointer items-center rounded-full px-1 outline-none focus-visible:ring-2 focus-visible:ring-[#3a86ea]/70"
      onClick={onToggle}
      // In the body's top margin, against the player's content box, far
      // enough in that the slot clears the rounded corner.
      style={{
        top: -BODY_PADDING,
        left: CORNER_CLEARANCE,
        height: BODY_PADDING,
      }}
      title={held ? "Hold is on: the controls are locked" : "Hold"}
      type="button"
    >
      <span className="relative block h-[9px] w-[21px] overflow-hidden rounded-full bg-black/[.06] shadow-[inset_0_1px_1.5px_rgb(0_0_0/.3),0_1px_0_var(--pod-rim)]">
        <span
          className={cx(
            "absolute inset-y-[1.5px] left-[1.5px] w-[9px] rounded-full bg-[#f08a1c] shadow-[inset_0_1px_1px_rgb(0_0_0/.25)] transition-opacity duration-200",
            held ? "opacity-100" : "opacity-0",
          )}
        />
        <span
          className={cx(
            "absolute inset-y-[1.5px] w-[10px] rounded-full bg-(image:--pod-body) shadow-[0_0.5px_1px_rgb(0_0_0/.35),inset_0_0.5px_0_var(--pod-rim)] transition-[left] duration-200 ease-soft group-active/hold:brightness-95 motion-reduce:transition-none",
            held ? "left-[9.5px]" : "left-[1.5px]",
          )}
        />
      </span>
      <HapticTap />
    </button>
  );
}
