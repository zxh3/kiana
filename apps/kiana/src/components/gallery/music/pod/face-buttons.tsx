import { cx } from "../../../../lib/class-names";
import { cue } from "../../../../lib/sounds";
import { BODY_PADDING, CORNER_CLEARANCE } from "./geometry";

/** Two strokes each, drawn at the size of a printed mark. */
const marks = {
  minimize: <path d="M2 4.5h5" />,
  close: <path d="m2.2 2.2 4.6 4.6m0-4.6L2.2 6.8" />,
};

function FaceButton({
  disabled,
  kind,
  label,
  onClick,
}: {
  disabled?: boolean;
  kind: keyof typeof marks;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="group/face grid size-5 cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#3a86ea]/70 disabled:pointer-events-none disabled:opacity-40"
      disabled={disabled}
      onClick={() => {
        cue("press");
        onClick();
      }}
      title={label}
      type="button"
    >
      {/* A shallow dimple pressed into the aluminium, its mark printed in
      the finish's own ink. */}
      <span className="grid size-[13px] place-items-center rounded-full bg-black/[.045] text-(--pod-print) shadow-[inset_0_1px_1.5px_rgb(0_0_0/.3),0_1px_0_var(--pod-rim)] transition-[color,background-color] duration-150 group-hover/face:bg-black/[.08] group-active/face:shadow-[inset_0_1px_2px_rgb(0_0_0/.45)]">
        <svg
          aria-hidden="true"
          fill="none"
          height="9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.4"
          viewBox="0 0 9 9"
          width="9"
        >
          {marks[kind]}
        </svg>
      </span>
    </button>
  );
}

/**
 * Minimize and close, set into the aluminium above the screen's right
 * corner, opposite the hold switch. They act on the widget, not on the
 * music, so they stay small and quiet: faint until the pointer is over the
 * player or the gallery's controls are showing, always there on touch
 * screens.
 */
export function FaceButtons({
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
        "absolute flex items-center gap-0.5 transition-opacity duration-300 group-focus-within/player:opacity-100 group-hover/player:opacity-100 [@media(hover:none)]:opacity-100",
        visible ? "opacity-100" : "opacity-0",
      )}
      // In the body's top margin, against the player's content box, far
      // enough in that the dimples clear the rounded corner.
      style={{
        top: -BODY_PADDING,
        right: CORNER_CLEARANCE,
        height: BODY_PADDING,
      }}
    >
      <FaceButton
        disabled={!canMinimize}
        kind="minimize"
        label="Minimize the music player"
        onClick={onMinimize}
      />
      <FaceButton
        kind="close"
        label="Close the music player"
        onClick={onClose}
      />
    </div>
  );
}
