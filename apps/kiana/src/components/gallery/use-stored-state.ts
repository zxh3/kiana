import { useCallback, useState } from "react";

export function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferences still apply for the current visit.
  }
}

export function removeStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to remove where storage is blocked.
  }
}

/**
 * The parsers most stored preferences share. Each tolerates a missing or
 * junk value by falling back to the default, as every `parse` must.
 */

/** A saved level from 0 to 100, or `fallback`. */
export function parseLevel(raw: string | null, fallback = 100) {
  const value = Number(raw);
  return raw !== null && raw !== "" && value >= 0 && value <= 100
    ? Math.round(value)
    : fallback;
}

/** Off unless it was turned on. */
export function parseFlag(raw: string | null) {
  return raw === "true";
}

/** On unless it was turned off. */
export function parseFlagOn(raw: string | null) {
  return raw !== "false";
}

/**
 * State mirrored to localStorage. `parse` must tolerate null and junk so a
 * blocked or stale store falls back to defaults.
 */
export function useStoredState<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string = String,
) {
  const [value, setValue] = useState(() => parse(readStorage(key)));
  const update = useCallback(
    (next: T) => {
      setValue(next);
      writeStorage(key, serialize(next));
    },
    [key, serialize],
  );
  return [value, update] as const;
}
