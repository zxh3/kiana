/**
 * The full player's proportions, shared by the parts drawn inside the body
 * and the pieces laid over it (the YouTube frame, the glare, the switch).
 */

/**
 * The aluminium around the screen. A generous margin, as on the original,
 * lets the window's small corners sit comfortably inside the body's large
 * ones; a tight one makes the two curves fight.
 */
export const BODY_PADDING = 18;
export const BODY_RADIUS = 32;

/**
 * How far in from the screen's edge the controls in the top margin (hold,
 * minimize, close) sit, so they clear the body's rounded corners.
 */
export const CORNER_CLEARANCE = 4;

/** The window's dark border around the display. */
export const DISPLAY_INSET = 4;

/** The glass window, from the body's top-left corner. */
export const glassFrame = {
  top: BODY_PADDING,
  left: BODY_PADDING,
  width: 212,
  height: 159,
};

export const BODY_WIDTH = glassFrame.width + BODY_PADDING * 2;

/** The display inside the window. */
const displayFrame = {
  top: glassFrame.top + DISPLAY_INSET,
  left: glassFrame.left + DISPLAY_INSET,
  width: glassFrame.width - DISPLAY_INSET * 2,
  height: glassFrame.height - DISPLAY_INSET * 2,
};

/** The display's grey title bar. */
export const STATUS_BAR_HEIGHT = 18;

/** The video overlaps the dark border by a pixel, so no white edge shows. */
export const videoFrame = {
  top: displayFrame.top - 1,
  left: displayFrame.left - 1,
  width: displayFrame.width + 2,
  height: displayFrame.height + 2,
};

/**
 * The video opened from Now Playing sits under the title bar, which stays
 * to go back; only when YouTube needs a tap or a sign-in does it take the
 * whole display, so its prompt has room.
 */
export const videoBelowTitleFrame = {
  ...videoFrame,
  top: displayFrame.top + STATUS_BAR_HEIGHT,
  height: videoFrame.height - STATUS_BAR_HEIGHT - 1,
};
