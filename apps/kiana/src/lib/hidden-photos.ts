import { isAssetId } from "./favorites";

/**
 * Photos an admin has hidden from the gallery, as the browser and the
 * Worker (`src/server/hidden-photos.ts`) both see them. The release still
 * holds them; the gallery leaves them out, and an admin can show them
 * again. Kept free of both so the rules can be tested on their own.
 */

/** A hidden photo: its id, who hid it (a name), and when. */
export type HiddenPhoto = {
  id: string;
  /** The admin's name, or null for one hidden before there were admins. */
  by: string | null;
  at: number;
};

/** Photos to hide and to show again, in one request. */
export type HiddenChange = { hide: string[]; show: string[] };

/**
 * The most photos one change touches, which keeps its writes within what
 * the database takes from one request.
 */
export const HIDDEN_CHANGE_MAX = 1_000;

function readIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || !raw.every(isAssetId)) return null;
  return [...new Set(raw)];
}

/**
 * A change an admin's browser sent, or null for anything else. A photo
 * both hidden and shown in one change is a mistake, not a choice.
 */
export function parseHiddenChange(raw: unknown): HiddenChange | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { hide = [], show = [] } = raw as Record<string, unknown>;
  const hiding = readIds(hide);
  const showing = readIds(show);
  if (!hiding || !showing) return null;
  const size = hiding.length + showing.length;
  if (size === 0 || size > HIDDEN_CHANGE_MAX) return null;
  if (showing.some((id) => hiding.includes(id))) return null;
  return { hide: hiding, show: showing };
}

/** The hidden photos by id, for looking each up as the grid draws. */
export type HiddenIndex = ReadonlyMap<string, HiddenPhoto>;

export function indexHidden(hidden: ReadonlyArray<HiddenPhoto>): HiddenIndex {
  return new Map(hidden.map((photo) => [photo.id, photo]));
}

/**
 * The hidden photos after a change, as an admin's browser shows it before
 * the Worker answers: hiding keeps who hid a photo first, and when.
 */
export function applyHiddenChange(
  hidden: HiddenIndex,
  { hide, show }: HiddenChange,
  by: string,
  at: number,
): HiddenIndex {
  const next = new Map(hidden);
  for (const id of show) next.delete(id);
  for (const id of hide) if (!next.has(id)) next.set(id, { id, by, at });
  return next;
}
