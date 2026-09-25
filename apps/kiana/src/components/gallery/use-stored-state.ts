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
