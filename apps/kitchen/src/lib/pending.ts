/**
 * What *this tab* is currently doing.
 *
 * Everything else the console shows now comes from Modal: running sandboxes,
 * stopped ones (terminated sandboxes keep their tags, so their shape and stop
 * time survive), and snapshots. Two browsers with the same credentials see the
 * same list because none of it lives here.
 *
 * What cannot come from Modal is an operation still in flight — a sandbox that
 * is being built does not exist yet, and a launch that failed left nothing
 * behind. That is genuinely local: it belongs to the tab that started it, and
 * it is persisted only so a reload does not lose track of it.
 */

import type { OpPhase, SandboxSpec } from "$lib/types";

export interface PendingOp {
  kind: "creating" | "stopping";
  /** The spec, so a failed launch can be retried without re-entering it. */
  spec: SandboxSpec;
  startedAt: string;
  phase: OpPhase | null;
  error: string | null;
}

export type PendingOps = Record<string, PendingOp>;

/** An operation pending this long is reported as stuck rather than in flight. */
export const OP_STALE_MS = 8 * 60 * 1000;

const key = (workspace: string) => `kitchen-pending:${workspace}`;

export function loadPending(workspace: string): PendingOps {
  try {
    const raw = JSON.parse(localStorage.getItem(key(workspace)) ?? "{}");
    const ops: PendingOps = {};
    for (const [name, op] of Object.entries(raw as PendingOps)) {
      if (op?.spec && op.kind) ops[name] = op;
    }
    return ops;
  } catch {
    return {};
  }
}

function save(workspace: string, ops: PendingOps): void {
  localStorage.setItem(key(workspace), JSON.stringify(ops));
}

function update(
  workspace: string,
  name: string,
  fn: (op: PendingOp | undefined) => PendingOp | null,
): void {
  const ops = loadPending(workspace);
  const next = fn(ops[name]);
  if (next === null) delete ops[name];
  else ops[name] = next;
  save(workspace, ops);
}

export function markCreating(workspace: string, spec: SandboxSpec): void {
  update(workspace, spec.name, () => ({
    kind: "creating",
    spec,
    startedAt: new Date().toISOString(),
    phase: null,
    error: null,
  }));
}

export function markStopping(
  workspace: string,
  name: string,
  spec: SandboxSpec,
): void {
  update(workspace, name, () => ({
    kind: "stopping",
    spec,
    startedAt: new Date().toISOString(),
    phase: null,
    error: null,
  }));
}

export function setPhase(
  workspace: string,
  name: string,
  phase: OpPhase,
): void {
  update(workspace, name, (op) => (op ? { ...op, phase } : null));
}

/** The operation finished; Modal's own list is the truth from here on. */
export function clearPending(workspace: string, name: string): void {
  update(workspace, name, () => null);
}

export function markFailed(
  workspace: string,
  name: string,
  error: string,
): void {
  update(workspace, name, (op) =>
    op ? { ...op, kind: "creating", phase: null, error } : null,
  );
}
