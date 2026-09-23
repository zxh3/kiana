import { useCallback, useEffect, useState } from "react";

import { readStorage, writeStorage } from "./use-stored-state";

const FAVORITES_KEY = "kiana.favorites";

export function parseFavorites(raw: string | null): ReadonlySet<string> {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return new Set(
      Array.isArray(value)
        ? value.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

/** Favorites live in this browser and stay in sync across its tabs. */
export function useFavorites() {
  const [favorites, setFavorites] = useState(() =>
    parseFavorites(readStorage(FAVORITES_KEY)),
  );

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === FAVORITES_KEY) {
        setFavorites(parseFavorites(event.newValue));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(favorites);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setFavorites(next);
      writeStorage(FAVORITES_KEY, JSON.stringify([...next]));
    },
    [favorites],
  );

  return { favorites, toggle };
}
