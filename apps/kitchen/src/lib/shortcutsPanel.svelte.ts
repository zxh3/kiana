/**
 * Whether the shortcuts panel is open.
 *
 * The panel lives in the layout (the `?` key is global) but every screen wants
 * a visible way in — discovering `?` by guessing is not discovery.
 */
export const shortcutsPanel = $state({ open: false });
