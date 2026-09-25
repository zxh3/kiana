import type { GalleryAsset } from "../../data/photos";
import type {
  HiddenChange,
  HiddenIndex,
  HiddenPhoto,
} from "../../lib/hidden-photos";
import { formatPhotoDate, localDateKey } from "../gallery/model";

/**
 * The admin page's photo rules, kept free of React so they can be tested
 * on their own: which photos each filter shows, how many, and what a
 * selection hides or shows.
 */

export const photoFilters = ["all", "shown", "hidden"] as const;
export type PhotoFilter = (typeof photoFilters)[number];

export const photoFilterLabels: Record<PhotoFilter, string> = {
  all: "All",
  shown: "Shown",
  hidden: "Hidden",
};

/**
 * The asset indexes a filter shows, newest first, then the undated, so
 * the latest photos, the likeliest to need a look, come first.
 */
export function adminIndexes(
  assets: ReadonlyArray<GalleryAsset>,
  chronological: ReadonlyArray<number>,
  filter: PhotoFilter,
  hidden: HiddenIndex,
) {
  const dated: number[] = [];
  const undated: number[] = [];
  for (let at = chronological.length - 1; at >= 0; at -= 1) {
    const index = chronological[at];
    const asset = assets[index];
    const isHidden = hidden.has(asset.id);
    if (filter === "shown" && isHidden) continue;
    if (filter === "hidden" && !isHidden) continue;
    (asset.date ? dated : undated).push(index);
  }
  return [...dated, ...undated.reverse()];
}

/**
 * How many photos each filter holds. Only photos in the release count:
 * one hidden from an earlier release is not in the grid to show again.
 */
export function photoCounts(
  assets: ReadonlyArray<GalleryAsset>,
  hidden: HiddenIndex,
): Record<PhotoFilter, number> {
  const hiddenCount = assets.reduce(
    (count, { id }) => count + Number(hidden.has(id)),
    0,
  );
  return {
    all: assets.length,
    shown: assets.length - hiddenCount,
    hidden: hiddenCount,
  };
}

/**
 * The indexes from `from` to `to`, either way round, in the order the grid
 * shows them, for a shift-click.
 */
export function selectRange(
  order: ReadonlyArray<number>,
  from: number,
  to: number,
) {
  const start = order.indexOf(from);
  const end = order.indexOf(to);
  if (start < 0 || end < 0) return [to];
  return order.slice(Math.min(start, end), Math.max(start, end) + 1);
}

/** The selection with `indexes` added, or taken out when all were in it. */
export function toggleSelection(
  selection: ReadonlySet<number>,
  indexes: ReadonlyArray<number>,
) {
  const next = new Set(selection);
  const allIn = indexes.every((index) => next.has(index));
  for (const index of indexes) {
    if (allIn) next.delete(index);
    else next.add(index);
  }
  return next;
}

/**
 * What hiding or showing the selection changes: only the photos not
 * already that way, or null when there are none.
 */
export function changeFor(
  assets: ReadonlyArray<GalleryAsset>,
  selection: Iterable<number>,
  hidden: HiddenIndex,
  action: "hide" | "show",
): HiddenChange | null {
  const ids: string[] = [];
  for (const index of selection) {
    const { id } = assets[index];
    if (hidden.has(id) !== (action === "hide")) ids.push(id);
  }
  if (ids.length === 0) return null;
  return action === "hide" ? { hide: ids, show: [] } : { hide: [], show: ids };
}

/** "Hidden by Xiaohua on 24 September 2026", or without a name for an old one. */
export function describeHidden({ by, at }: HiddenPhoto) {
  const day = formatPhotoDate(localDateKey(new Date(at)));
  return by ? `Hidden by ${by} on ${day}` : `Hidden on ${day}`;
}
