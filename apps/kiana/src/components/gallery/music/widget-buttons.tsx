import { cx } from "../../../lib/class-names";
import { cue } from "../../../lib/sounds";
import { focusRing } from "../control-button";
import { CloseIcon, MinimizeIcon } from "../icons";

const button = cx(
  "glass grid size-7 cursor-pointer place-items-center rounded-full text-paper/80 transition-colors hover:text-paper disabled:opacity-40",
  focusRing,
);

/**
 * Minimize and close act on the widget, not the device, so they sit just
 * outside the player's corner. They come and go with the gallery's
 * controls, stay while the pointer is over the player (its `group`), and
 * always show on touch screens.
 */
export function WidgetButtons({
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
        "absolute -top-2.5 -right-2.5 z-30 flex gap-1 transition-opacity duration-300 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <button
        aria-label="Minimize the music player"
        className={button}
        disabled={!canMinimize}
        onClick={() => {
          cue("press");
          onMinimize();
        }}
        title="Minimize"
        type="button"
      >
        <MinimizeIcon size={14} />
      </button>
      <button
        aria-label="Close the music player"
        className={button}
        onClick={() => {
          cue("press");
          onClose();
        }}
        title="Close"
        type="button"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}
