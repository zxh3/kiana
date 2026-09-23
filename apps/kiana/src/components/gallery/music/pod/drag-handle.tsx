import { BODY_PADDING } from "./geometry";

/** The attribute the widget's drag looks for; only this starts a move. */
export const DRAG_HANDLE = "data-drag-handle";

/**
 * The grip that moves the player, set in the bottom margin where the dock
 * connector sits on the original. Faint until hovered, so the device keeps
 * its clean face; everything else on the body is for playing music.
 */
export function DragHandle() {
  return (
    <div
      {...{ [DRAG_HANDLE]: "" }}
      aria-hidden="true"
      className="group/handle absolute left-1/2 flex h-[18px] w-16 -translate-x-1/2 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      // Centred in the body's bottom margin, below the player's content box.
      style={{ bottom: -BODY_PADDING }}
      title="Drag to move"
    >
      <span className="h-[4px] w-8 rounded-full bg-(--pod-print) opacity-35 shadow-[inset_0_1px_1px_rgb(0_0_0/.25)] transition-opacity duration-200 group-hover/handle:opacity-80" />
    </div>
  );
}
