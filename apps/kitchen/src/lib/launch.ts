/**
 * Launching a sandbox, from the browser's side.
 *
 * Creation is slow enough (a first-time image build runs minutes) that it
 * cannot block a dialog or a button. So the caller fires this and forgets: the
 * row is recorded as "creating" in the sandbox store immediately, phases
 * stream in from the server, and the outcome lands in the store either way.
 *
 * The awkward case is a launch whose connection dies mid-build — a real thing
 * on long gRPC image builds behind proxies. The sandbox may well come up
 * anyway, so instead of reporting failure we poll the list for the name before
 * deciding. Retrying is safe regardless: cached layers make a rebuild quick,
 * and the name is the state identity, so a second attempt resumes the same
 * /workspace.
 */

import { api } from "$lib/api";
import { credentialHeaders } from "$lib/creds";
import {
  markCreating,
  markFailed,
  markLaunched,
  markStopped,
  markStopping,
  setPhase,
} from "$lib/sandboxStore";
import type {
  OpEvent,
  OpPhase,
  RestorePoint,
  RetentionDays,
  SandboxInfo,
  SandboxSpec,
} from "$lib/types";

/** How long to keep looking for the sandbox after a stream dies. */
const RECOVER_ATTEMPTS = 24;
const RECOVER_INTERVAL_MS = 5000;
/** Modal frees a terminated sandbox's name a few seconds later. */
const NAME_RETRY_ATTEMPTS = 5;
const NAME_RETRY_INTERVAL_MS = 4000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface LaunchHandlers {
  onPhase?: (phase: OpPhase) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

async function isRunning(name: string): Promise<boolean> {
  try {
    const { sandboxes } = await api<{ sandboxes: SandboxInfo[] }>(
      "/api/sandboxes",
    );
    return sandboxes.some((sb) => sb.name === name);
  } catch {
    return false;
  }
}

/**
 * Drive one NDJSON progress stream to a verdict. Shared by starting and
 * stopping: both are slow, both report phases, both end in success or a
 * message.
 */
export async function driveStream(
  request: () => Promise<Response>,
  onPhase: (phase: OpPhase) => void,
  /** Called for every event, for callers that need the terminal payload. */
  onEvent: (event: OpEvent) => void = () => {},
): Promise<{ ok: true } | { ok: false; error: string; streamDied: boolean }> {
  let res: Response;
  try {
    res = await request();
  } catch (e) {
    return { ok: false, error: String(e), streamDied: true };
  }

  if (!res.ok || !res.body) {
    // Validation and auth failures still answer with a plain JSON error.
    const body = await res.json().catch(() => ({}));
    return {
      ok: false,
      error: body?.error ?? `Request failed (${res.status}).`,
      streamDied: false,
    };
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let verdict: { ok: true } | { ok: false; error: string } | null = null;
  try {
    while (!verdict) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let event: OpEvent;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        onEvent(event);
        if ("phase" in event) onPhase(event.phase);
        else if ("error" in event) verdict = { ok: false, error: event.error };
        // Anything else is the terminal success payload — a sandbox id, a
        // saved point, or a bare done.
        else verdict = { ok: true };
      }
    }
  } catch (e) {
    return { ok: false, error: String(e), streamDied: true };
  } finally {
    reader.cancel().catch(() => {});
  }

  if (verdict?.ok) return { ok: true };
  if (verdict) return { ...verdict, streamDied: false };
  // Stream ended without a verdict — the connection was cut mid-launch.
  return {
    ok: false,
    error: "The connection dropped mid-launch.",
    streamDied: true,
  };
}

/**
 * Launch `spec` and keep the sandbox store in step. Resolves when the outcome
 * is known; callers that want to stay responsive should not await it.
 */
export interface LaunchOptions {
  /** Boot this restore point rather than the sandbox's newest. */
  fromPoint?: string;
  /** Lineage to record when this launch is a fork. */
  forkedFrom?: string;
  /** Ignore restore points and build a new machine. */
  fresh?: boolean;
}

export async function launch(
  workspace: string,
  spec: SandboxSpec,
  handlers: LaunchHandlers = {},
  options: LaunchOptions = {},
): Promise<void> {
  const phase = (p: OpPhase) => {
    setPhase(workspace, spec.name, p);
    handlers.onPhase?.(p);
  };
  const fail = (error: string) => {
    markFailed(workspace, spec.name, error);
    handlers.onError?.(error);
  };

  markCreating(workspace, spec);
  handlers.onPhase?.("resolving");

  for (let tries = 1; ; tries++) {
    const result = await driveStream(
      () =>
        fetch("/api/sandboxes", {
          method: "POST",
          headers: {
            ...credentialHeaders(),
            "content-type": "application/json",
          },
          body: JSON.stringify({
            ...spec,
            gpu: spec.gpu ?? "none",
            fromPoint: options.fromPoint,
            forkedFrom: options.forkedFrom,
            fresh: options.fresh,
          }),
        }),
      phase,
    );
    if (result.ok) {
      markLaunched(workspace, spec.name);
      handlers.onDone?.();
      return;
    }

    // "Already running" means one of two very different things. If a sandbox
    // with this name is actually in the list, the name is taken and the user
    // has to pick another. If it is not, Modal is simply still holding the
    // name of one just terminated — a restart, so wait it out.
    if (
      result.error.includes("already running") &&
      tries < NAME_RETRY_ATTEMPTS
    ) {
      if (!(await isRunning(spec.name))) {
        phase("waiting");
        await sleep(NAME_RETRY_INTERVAL_MS);
        continue;
      }
    }

    if (!result.streamDied) {
      fail(result.error);
      return;
    }

    // The launch may have survived the broken connection: watch the list.
    for (let i = 0; i < RECOVER_ATTEMPTS; i++) {
      await sleep(RECOVER_INTERVAL_MS);
      if (await isRunning(spec.name)) {
        markLaunched(workspace, spec.name);
        handlers.onDone?.();
        return;
      }
    }
    fail(
      "Lost contact with the launch and the sandbox never came up. Retrying is safe — the build resumes from cache.",
    );
    return;
  }
}

/**
 * Stop a sandbox, saving a restore point on the way out.
 *
 * Like `launch`, this is fire-and-forget: the snapshot is the slow part, and
 * the row shows its phases. A label makes the resulting point permanent;
 * `save: false` discards the machine state instead.
 */
export async function stop(
  workspace: string,
  sandboxId: string,
  name: string,
  options: { save: boolean; retentionDays: RetentionDays; label?: string },
  handlers: LaunchHandlers = {},
): Promise<void> {
  markStopping(workspace, name);
  handlers.onPhase?.(options.save ? "snapshotting" : "stopping");

  const query = new URLSearchParams({
    save: options.save ? "1" : "0",
    retentionDays:
      options.retentionDays === null
        ? "forever"
        : String(options.retentionDays),
  });
  if (options.label) query.set("label", options.label);

  const result = await driveStream(
    () =>
      fetch(`/api/sandboxes/${sandboxId}?${query}`, {
        method: "DELETE",
        headers: credentialHeaders(),
      }),
    (phase) => {
      setPhase(workspace, name, phase);
      handlers.onPhase?.(phase);
    },
  );

  // Either way the sandbox is on its way out; the list reconciler settles the
  // row. A failed snapshot leaves it running, which the next poll reveals.
  markStopped(workspace, name);
  if (result.ok) handlers.onDone?.();
  else handlers.onError?.(result.error);
}

/**
 * Save a restore point of a running sandbox, leaving it running.
 *
 * The counterpart to Stop-and-save: same snapshot, no shutdown. Resolves with
 * the point so a caller can show what it captured.
 */
export async function savePoint(
  sandboxId: string,
  options: { retentionDays: RetentionDays; label?: string },
  onPhase: (phase: OpPhase) => void = () => {},
): Promise<{ ok: true; point: RestorePoint } | { ok: false; error: string }> {
  const query = new URLSearchParams({
    retentionDays:
      options.retentionDays === null
        ? "forever"
        : String(options.retentionDays),
  });
  if (options.label) query.set("label", options.label);

  let saved: RestorePoint | null = null;
  const result = await driveStream(
    () =>
      fetch(`/api/sandboxes/${sandboxId}/restore-point?${query}`, {
        method: "POST",
        headers: credentialHeaders(),
      }),
    onPhase,
    (event) => {
      if ("point" in event) saved = event.point;
    },
  );
  if (!result.ok) return { ok: false, error: result.error };
  if (!saved) return { ok: false, error: "The save finished without a point." };
  return { ok: true, point: saved };
}
