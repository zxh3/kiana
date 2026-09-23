import { cx } from "../../../../lib/class-names";
import { BODY_PADDING, BODY_RADIUS } from "./geometry";

/** How far the switch stands above the body's top edge. */
const SLOT_RISE = 4;

/**
 * The hold switch on the top edge, peeking over the body. Sliding it on
 * shows its orange side and locks every control, so a player in a pocket
 * (or under a stray hand) does nothing it was not asked to.
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
      className="absolute flex h-6 w-11 cursor-pointer justify-center rounded-full pt-2 outline-none focus-visible:ring-2 focus-visible:ring-[#3a86ea]/70"
      onClick={onToggle}
      // Placed against the player's content box, which the body's padding
      // insets: the slot rises 4px above the top edge, just past the corner.
      style={{
        top: -BODY_PADDING - SLOT_RISE - 8,
        left: BODY_RADIUS - BODY_PADDING - 4,
      }}
      title={held ? "Hold is on: controls are locked" : "Hold"}
      type="button"
    >
      <span className="relative block h-[7px] w-[26px] overflow-hidden rounded-full bg-[#2a2a2c] shadow-[inset_0_1px_2px_rgb(0_0_0/.6)]">
        <span className="absolute inset-y-0 left-0 w-1/2 bg-[#f08a1c]" />
        <span
          className={cx(
            "absolute inset-y-0 w-[14px] rounded-full bg-(image:--pod-body) shadow-[inset_0_1px_0_var(--pod-rim),0_0_0_0.5px_rgb(0_0_0/.35)] transition-[left] duration-200 ease-soft motion-reduce:transition-none",
            held ? "left-[12px]" : "left-0",
          )}
        />
      </span>
    </button>
  );
}
