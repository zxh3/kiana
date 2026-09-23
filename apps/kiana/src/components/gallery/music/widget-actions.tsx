import { Fragment } from "react";

import { cx } from "../../../lib/class-names";
import { cue } from "../../../lib/sounds";
import { focusRing } from "../control-button";

const action = cx(
  "label cursor-pointer rounded-full px-1.5 py-1.5 text-paper/35 [text-shadow:0_1px_8px_rgb(0_0_0/.55)] transition-colors duration-200 hover:text-paper/85 disabled:pointer-events-none disabled:opacity-40",
  focusRing,
);

/**
 * Minimize and close, as two faint words under the player. They act on the
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
  const actions = [
    { label: "Minimize", onClick: onMinimize, disabled: !canMinimize },
    { label: "Close", onClick: onClose, disabled: false },
  ];
  return (
    <div
      className={cx(
        "mt-2 flex items-center justify-center transition-opacity duration-300 group-focus-within/player:opacity-100 group-hover/player:opacity-100 [@media(hover:none)]:opacity-100",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      {actions.map(({ disabled, label, onClick }, index) => (
        <Fragment key={label}>
          {index > 0 ? (
            <span
              aria-hidden="true"
              className="px-0.5 text-[10px] text-paper/20"
            >
              ·
            </span>
          ) : null}
          <button
            aria-label={`${label} the music player`}
            className={action}
            disabled={disabled}
            onClick={() => {
              cue("press");
              onClick();
            }}
            type="button"
          >
            {label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
