/**
 * A tiny external store for video progress. Videos report progress every
 * frame; routing it here re-renders only the progress bar, not the gallery.
 */
export function createProgressChannel() {
  let value = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: number) => {
      if (next === value) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ProgressChannel = ReturnType<typeof createProgressChannel>;
