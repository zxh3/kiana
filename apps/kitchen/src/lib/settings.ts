/**
 * Workspace-level preferences. Only one so far: how long automatic restore
 * snapshots live.
 *
 * A snapshot's TTL is fixed when it is taken and can never be read back or
 * changed, so this is a policy for *new* snapshots, not a retroactive setting —
 * which is why each snapshot records the retention it was created with.
 */

import { defaultRetentionDays, type RetentionDays } from "$lib/types";

const KEY = "kitchen-settings";

interface Settings {
  retentionDays: RetentionDays;
}

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const days = raw?.retentionDays;
    if (days === null || [7, 30, 90].includes(days)) {
      return { retentionDays: days };
    }
  } catch {
    // fall through to the default
  }
  return { retentionDays: defaultRetentionDays };
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
