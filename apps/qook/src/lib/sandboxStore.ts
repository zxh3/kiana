/**
 * Browser-side memory of sandboxes, keyed by workspace then name. Modal only
 * lists *running* sandboxes, so this store is what lets terminated ones stay
 * in the table as "stopped" rows that can be recreated (name-keyed state
 * makes recreation a resume). localStorage only — another browser won't see
 * these rows, same trust model as the credentials.
 *
 * It also holds in-flight operations. A launch can outlive the tab that
 * started it (image builds take minutes), so `op` is persisted: after a
 * reload the row still says "creating" instead of silently reverting to
 * stopped, and reconciliation against Modal's list resolves it.
 */

import type { LaunchPhase, SandboxSpec } from "$lib/types";

export interface StoredOp {
  kind: "creating" | "stopping";
  startedAt: string;
  phase: LaunchPhase | null;
}

export interface StoredSandbox {
  spec: SandboxSpec;
  createdAt: string;
  stoppedAt: string | null;
  op: StoredOp | null;
  /** Last launch failure, shown on the row until retried or dismissed. */
  error: string | null;
}

export type SandboxStore = Record<string, StoredSandbox>;

/** A launch that has been pending this long is reported as stuck. */
export const OP_STALE_MS = 8 * 60 * 1000;

const key = (workspace: string) => `qook-sandboxes:${workspace}`;

export function loadSandboxStore(workspace: string): SandboxStore {
  let raw: Record<string, Partial<StoredSandbox>>;
  try {
    raw = JSON.parse(localStorage.getItem(key(workspace)) ?? "{}");
  } catch {
    return {};
  }
  // Records written before ops existed are missing the newer fields.
  const store: SandboxStore = {};
  for (const [name, record] of Object.entries(raw)) {
    if (!record?.spec) continue;
    store[name] = {
      spec: record.spec,
      createdAt: record.createdAt ?? new Date().toISOString(),
      stoppedAt: record.stoppedAt ?? null,
      op: record.op ?? null,
      error: record.error ?? null,
    };
  }
  return store;
}

export function saveSandboxStore(workspace: string, store: SandboxStore): void {
  localStorage.setItem(key(workspace), JSON.stringify(store));
}

function update(
  workspace: string,
  name: string,
  fn: (record: StoredSandbox | undefined) => StoredSandbox | null,
): void {
  const store = loadSandboxStore(workspace);
  const next = fn(store[name]);
  if (next === null) delete store[name];
  else store[name] = next;
  saveSandboxStore(workspace, store);
}

/** Record an optimistic row the moment a launch starts. */
export function markCreating(
  workspace: string,
  spec: SandboxSpec,
  now = new Date().toISOString(),
): void {
  update(workspace, spec.name, (record) => ({
    spec,
    createdAt: record?.createdAt ?? now,
    stoppedAt: record?.stoppedAt ?? null,
    op: { kind: "creating", startedAt: now, phase: null },
    error: null,
  }));
}

export function setPhase(
  workspace: string,
  name: string,
  phase: LaunchPhase,
): void {
  update(workspace, name, (record) =>
    record?.op ? { ...record, op: { ...record.op, phase } } : (record ?? null),
  );
}

/** The launch succeeded: the row is Modal's now. */
export function markLaunched(workspace: string, name: string): void {
  update(workspace, name, (record) =>
    record
      ? {
          ...record,
          createdAt: new Date().toISOString(),
          stoppedAt: null,
          op: null,
          error: null,
        }
      : null,
  );
}

export function markFailed(
  workspace: string,
  name: string,
  error: string,
): void {
  update(workspace, name, (record) =>
    record ? { ...record, op: null, error } : null,
  );
}

export function clearError(workspace: string, name: string): void {
  update(workspace, name, (record) =>
    record ? { ...record, error: null } : null,
  );
}

export function markStopping(workspace: string, name: string): void {
  update(workspace, name, (record) =>
    record
      ? {
          ...record,
          op: {
            kind: "stopping",
            startedAt: new Date().toISOString(),
            phase: null,
          },
        }
      : null,
  );
}

export function markStopped(workspace: string, name: string): void {
  update(workspace, name, (record) =>
    record
      ? {
          ...record,
          op: null,
          stoppedAt: record.stoppedAt ?? new Date().toISOString(),
        }
      : null,
  );
}

export function forgetSandbox(workspace: string, name: string): void {
  update(workspace, name, () => null);
}
