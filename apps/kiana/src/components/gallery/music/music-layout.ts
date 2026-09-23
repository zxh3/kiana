export const corners = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
export type Corner = (typeof corners)[number];
export type PlayerSize = "mini" | "full";

const PHONE_QUERY = "(max-width: 639px)";

function onPhone() {
  return (
    typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches
  );
}

/** Phones start with a small pill under the top bar; wider screens with the
 * full card in the bottom-right corner. A choice the viewer made wins. */
export function parseCorner(raw: string | null): Corner {
  if (corners.includes(raw as Corner)) return raw as Corner;
  return onPhone() ? "top-right" : "bottom-right";
}

export function parsePlayerSize(raw: string | null): PlayerSize {
  if (raw === "mini" || raw === "full") return raw;
  return onPhone() ? "mini" : "full";
}

/** The corner whose quadrant holds the point, as a card lands after a drag. */
export function nearestCorner(
  x: number,
  y: number,
  width: number,
  height: number,
): Corner {
  const vertical = y < height / 2 ? "top" : "bottom";
  const horizontal = x < width / 2 ? "left" : "right";
  return `${vertical}-${horizontal}`;
}
