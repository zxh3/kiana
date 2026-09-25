/**
 * Favorites as the browser and the Worker (`src/server/favorites.ts`) both
 * see them: the ids of the photos someone signed in has saved, kept by
 * their account. Kept free of both so the rules can be tested on their own.
 */

/** Where the browser reads and changes the viewer's favorites. */
export const FAVORITES_PATH = "/api/favorites";

/** The most favorites an account keeps, well past the whole library. */
export const FAVORITES_MAX = 20_000;

/** Photos to add to the favorites and to take out, in one request. */
export type FavoritesChange = { add: string[]; remove: string[] };

/** A photo's id as the library gives it: a UUID, or something like one. */
export function isAssetId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9-]{1,64}$/.test(value);
}

/** A list of photo ids, without repeats, or null if it is not one. */
function readIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length > FAVORITES_MAX) return null;
  if (!raw.every(isAssetId)) return null;
  return [...new Set(raw)];
}

/** A change a browser sent, or null for anything else. */
export function parseFavoritesChange(raw: unknown): FavoritesChange | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { add = [], remove = [] } = raw as Record<string, unknown>;
  const adding = readIds(add);
  const removing = readIds(remove);
  if (!adding || !removing || adding.length + removing.length === 0) {
    return null;
  }
  return { add: adding, remove: removing };
}

/** The favorites the Worker answered with, or null if it said otherwise. */
export function parseFavoriteIds(raw: unknown): string[] | null {
  if (typeof raw !== "object" || raw === null) return null;
  return readIds((raw as Record<string, unknown>).ids);
}
