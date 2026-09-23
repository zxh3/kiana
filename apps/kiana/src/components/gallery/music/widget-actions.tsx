import { cx } from "../../../lib/class-names";
import { cue } from "../../../lib/sounds";
import { focusRing } from "../control-button";
import { ChevronDownIcon, CloseIcon } from "../icons";

const action = cx(
  "label flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-paper/70 transition-[color,background-color] duration-200 hover:bg-paper/10 hover:text-paper disabled:pointer-events-none disabled:opacity-35",
  focusRing,
);

/**
 * Minimize and close, as one small glass pill under the player, like the
 * gallery's own chips. They act on the
 * widget rather than the device, so they stay off the device itself. They
 * come and go with the gallery's controls, show while the pointer is over
 * the player (the aside's `group/player`), and always show on touch
 * screens. The row keeps its space while hidden, so nothing shifts.
 */
export function WidgetActions({
  canMinimize,
  onClose,
  onMinimize,
  visible,
}: {
  canMinimize: boolean;
  onClose: () => void;
  onMinimize: () => void;
  visible: boolean;
}) {
  return (
    <div
      className={cx(
        "mt-2.5 flex justify-center transition-opacity duration-300 group-focus-within/player:opacity-100 group-hover/player:opacity-100 [@media(hover:none)]:opacity-100",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="glass flex items-center rounded-full p-0.5">
        <button
          className={action}
          disabled={!canMinimize}
          onClick={() => {
            cue("press");
            onMinimize();
          }}
          type="button"
        >
          <ChevronDownIcon size={13} />
          Minimize
        </button>
        <span aria-hidden="true" className="h-3 w-px bg-paper/15" />
        <button
          className={action}
          onClick={() => {
            cue("press");
            onClose();
          }}
          type="button"
        >
          <CloseIcon size={12} />
          Close
        </button>
      </div>
    </div>
  );
}
