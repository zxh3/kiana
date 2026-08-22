/**
 * Browser-side memory of sandboxes, keyed by workspace then name.
 *
 * This holds only what Modal cannot answer for us. Modal lists running
 * sandboxes, and snapshots say what each sandbox can go back to and when
 * its state was last captured — but a *stopped* sandbox's shape (cpu, memory,
 * gpu, image, mounts) lives nowhere server-side: sandbox tags die with the
 * sandbox, and an image tag cannot carry an image reference or a mount path.
 * So the spec is remembered here, and it is the reason stopped rows are
 * browser-local. Same trust model as the credentials.
 *
 * It also holds in-flight operations. A launch can outlive the tab that
 * started it (image builds take minutes), so `op` is persisted: after a
 * reload the row still says "creating" instead of silently reverting to
 * stopped, and reconciliation against Modal's list resolves it.
 */

import type { OpPhase, SandboxSpec } from "$lib/types";

export interface StoredOp {
  kind: "creating" | "stopping";
  startedAt: string;
  phase: OpPhase | null;
}

export interface StoredSandbox {
  spec: SandboxSpec;
  stoppedAt: string | null;
  op: StoredOp | null;
  /** Last launch failure, shown on the row until retried or dismissed. */
  error: string | null;
}

export type SandboxStore = Record<string, StoredSandbox>;

/** A launch that has been pending this long is reported as stuck. */
export const OP_STALE_MS = 8 * 60 * 1000;

const key = (workspace: string) => `kitchen-sandboxes:${workspace}`;

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
    stoppedAt: record?.stoppedAt ?? null,
    op: { kind: "creating", startedAt: now, phase: null },
    error: null,
  }));
}

export function setPhase(
  workspace: string,
  name: string,
  phase: OpPhase,
): void {
  update(workspace, name, (record) =>
    record?.op ? { ...record, op: { ...record.op, phase } } : (record ?? null),
  );
}

/** The launch succeeded: the row is Modal's now. */
export function markLaunched(workspace: string, name: string): void {
  update(workspace, name, (record) =>
    record ? { ...record, stoppedAt: null, op: null, error: null } : null,
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
