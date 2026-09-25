import type { FavoritesChange } from "../../lib/favorites";

/**
 * The viewer's favorites as the gallery shows them, as a pure reducer.
 * They are kept by the Worker for the account the viewer signed in with;
 * a change shows at once and is sent in its turn, one at a time, until
 * the Worker's answer has it, so hearts never flicker however slow the
 * connection. A change the Worker refuses is let go, and the heart goes
 * back. `use-favorites.ts` feeds it the requests' results.
 */

export type FavoritesState = {
  /** Idle while signed out; the rest only while signed in. */
  status: "idle" | "loading" | "ready" | "error";
  /** The favorites as the Worker last said. */
  saved: ReadonlySet<string>;
  /** Changes not saved yet, oldest first; the first is on its way. */
  pending: ReadonlyArray<PendingChange>;
  /** Changes saved so far, so an older read can tell it is out of date. */
  version: number;
  /** Changes the Worker refused, counted up, for the gallery to say so. */
  failures: number;
};

export type PendingChange = FavoritesChange & {
  /** Brings in the favorites this browser kept before signing in. */
  imported?: boolean;
};

export type FavoritesEvent =
  | { type: "signedOut" }
  | { type: "loading" }
  /** A read of every favorite, begun when `version` changes were saved. */
  | { type: "loaded"; ids: ReadonlyArray<string>; version: number }
  | { type: "loadFailed" }
  /** Turns one photo's heart over, as it shows now. */
  | { type: "toggle"; id: string }
  | { type: "change"; change: PendingChange }
  /** The first pending change was saved, and these are the favorites. */
  | { type: "saved"; ids: ReadonlyArray<string> }
  | { type: "saveFailed" };

export const initialFavoritesState: FavoritesState = {
  status: "idle",
  saved: new Set(),
  pending: [],
  version: 0,
  failures: 0,
};

export function favoritesReducer(
  state: FavoritesState,
  event: FavoritesEvent,
): FavoritesState {
  switch (event.type) {
    case "signedOut":
      return { ...initialFavoritesState, failures: state.failures };
    case "loading":
      return state.status === "idle" ? { ...state, status: "loading" } : state;
    case "loaded":
      // A read begun before a change was saved may not have it.
      if (event.version !== state.version) return state;
      return { ...state, status: "ready", saved: new Set(event.ids) };
    case "loadFailed":
      return state.status === "ready" ? state : { ...state, status: "error" };
    case "toggle":
      return {
        ...state,
        pending: [
          ...state.pending,
          toggleChange(shownFavorites(state), event.id),
        ],
      };
    case "change":
      return { ...state, pending: [...state.pending, event.change] };
    case "saved":
      return {
        ...state,
        saved: new Set(event.ids),
        pending: state.pending.slice(1),
        version: state.version + 1,
      };
    case "saveFailed":
      return {
        ...state,
        pending: state.pending.slice(1),
        failures: state.failures + 1,
      };
  }
}

/** The favorites to show: the saved ones, with the changes on their way. */
export function shownFavorites(
  state: Pick<FavoritesState, "pending" | "saved">,
): ReadonlySet<string> {
  if (state.pending.length === 0) return state.saved;
  const shown = new Set(state.saved);
  for (const { add, remove } of state.pending) {
    for (const id of add) shown.add(id);
    for (const id of remove) shown.delete(id);
  }
  return shown;
}

/** The change that turns one photo's heart over. */
export function toggleChange(
  shown: ReadonlySet<string>,
  id: string,
): FavoritesChange {
  return shown.has(id) ? { add: [], remove: [id] } : { add: [id], remove: [] };
}
