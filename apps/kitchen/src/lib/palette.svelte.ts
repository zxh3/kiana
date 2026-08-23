/**
 * Whether the command palette is open. A module, not a prop, because it is
 * opened from a global shortcut and from buttons on unrelated screens.
 */
export const palette = $state({ open: false });
