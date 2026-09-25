import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import {
  FAVORITES_MAX,
  FAVORITES_PATH,
  type FavoritesChange,
  isAssetId,
  parseFavoriteIds,
} from "../../lib/favorites";
import type { PodAccount } from "./account";
import {
  favoritesReducer,
  initialFavoritesState,
  shownFavorites,
} from "./favorites";
import { readStorage, removeStorage } from "./use-stored-state";

/** Where favorites were kept in this browser before signing in came. */
const LOCAL_KEY = "kiana.favorites";
/** A photo to favorite on coming back from signing in to favorite it. */
const AFTER_SIGN_IN_KEY = "kiana.favorite-after-sign-in";
/** Coming back to the page reads the favorites again, at most this often. */
const RELOAD_EVERY = 30_000;

/**
 * The favorites of the account the viewer signed in with, kept by the
 * Worker, so they are the same on every device; a guest has none. They
 * are read again when the page comes back into view, so another device's
 * changes show up. Favorites this browser kept before signing in came are
 * added to the account the first time it signs in, then let go.
 */
export function useFavorites({ member, status }: PodAccount) {
  const account = member?.id ?? null;
  const [state, dispatch] = useReducer(favoritesReducer, initialFavoritesState);
  const version = useRef(state.version);
  version.current = state.version;

  useEffect(() => {
    if (!account) {
      dispatch({ type: "signedOut" });
      return;
    }
    let live = true;
    let loadedAt = 0;
    const load = async () => {
      loadedAt = Date.now();
      const since = version.current;
      const ids = await request();
      if (!live) return;
      dispatch(
        ids ? { type: "loaded", ids, version: since } : { type: "loadFailed" },
      );
    };
    void load();
    const handleVisibility = () => {
      const due = Date.now() - loadedAt >= RELOAD_EVERY;
      if (document.visibilityState === "visible" && due) void load();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [account]);

  // Once the account's favorites are in: this browser's old ones join
  // them, and so does the photo the viewer signed in to favorite.
  const ready = state.status === "ready";
  useEffect(() => {
    if (!ready) return;
    const local = readLocalFavorites();
    if (local.length > 0) {
      dispatch({
        type: "change",
        change: { add: local, remove: [], imported: true },
      });
    } else {
      removeStorage(LOCAL_KEY);
    }
    const wanted = takeAfterSignIn();
    if (isAssetId(wanted)) {
      dispatch({ type: "change", change: { add: [wanted], remove: [] } });
    }
  }, [ready]);

  // The first change waiting goes to the Worker, and the next once it
  // answers.
  const next = account ? state.pending[0] : undefined;
  useEffect(() => {
    if (!next) return;
    let live = true;
    void request({ add: next.add, remove: next.remove }).then((ids) => {
      if (!live) return;
      if (ids && next.imported) removeStorage(LOCAL_KEY);
      dispatch(ids ? { type: "saved", ids } : { type: "saveFailed" });
    });
    return () => {
      live = false;
    };
  }, [next]);

  // The same set until something changes, since the slideshow's
  // collections are worked out from it.
  const { pending, saved } = state;
  const favorites = useMemo(
    () => shownFavorites({ pending, saved }),
    [pending, saved],
  );

  return {
    favorites,
    /**
     * Known for sure: a guest's (none), or read from the account. Not
     * while the session is still being checked.
     */
    settled: account ? state.status !== "idle" : status !== "checking",
    /** Changes the Worker refused, counted up. */
    failures: state.failures,
    toggle: useCallback((id: string) => dispatch({ type: "toggle", id }), []),
    /** Remembers a photo to favorite once the viewer is back, signed in. */
    favoriteAfterSignIn: useCallback((id: string) => {
      try {
        sessionStorage.setItem(AFTER_SIGN_IN_KEY, id);
      } catch {
        // They can press the heart again once back.
      }
    }, []),
  };
}

/** This browser's favorites from before signing in came, if any. */
function readLocalFavorites() {
  try {
    const value: unknown = JSON.parse(readStorage(LOCAL_KEY) ?? "[]");
    return Array.isArray(value)
      ? [...new Set(value.filter(isAssetId))].slice(0, FAVORITES_MAX)
      : [];
  } catch {
    return [];
  }
}

/** The photo to favorite after signing in, read once. */
function takeAfterSignIn() {
  try {
    const value = sessionStorage.getItem(AFTER_SIGN_IN_KEY);
    sessionStorage.removeItem(AFTER_SIGN_IN_KEY);
    return value;
  } catch {
    return null;
  }
}

/** Reads the favorites, or changes them first; null if that failed. */
async function request(change?: FavoritesChange) {
  try {
    const response = await fetch(
      FAVORITES_PATH,
      change
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(change),
          }
        : { cache: "no-store" },
    );
    return response.ok ? parseFavoriteIds(await response.json()) : null;
  } catch {
    return null;
  }
}
