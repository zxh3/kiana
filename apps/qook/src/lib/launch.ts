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
  setPhase,
} from "$lib/sandboxStore";
import type {
  LaunchEvent,
  LaunchPhase,
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
  onPhase?: (phase: LaunchPhase) => void;
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

/** One POST: drive the NDJSON stream to a verdict. */
async function attempt(
  spec: SandboxSpec,
  onPhase: (phase: LaunchPhase) => void,
): Promise<{ ok: true } | { ok: false; error: string; streamDied: boolean }> {
  let res: Response;
  try {
    res = await fetch("/api/sandboxes", {
      method: "POST",
      headers: { ...credentialHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ ...spec, gpu: spec.gpu ?? "none" }),
    });
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
        let event: LaunchEvent;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if ("phase" in event) onPhase(event.phase);
        else if ("sandboxId" in event) verdict = { ok: true };
        else if ("error" in event) verdict = { ok: false, error: event.error };
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
export async function launch(
  workspace: string,
  spec: SandboxSpec,
  handlers: LaunchHandlers = {},
): Promise<void> {
  const phase = (p: LaunchPhase) => {
    setPhase(workspace, spec.name, p);
    handlers.onPhase?.(p);
  };
  const fail = (error: string) => {
    markFailed(workspace, spec.name, error);
    handlers.onError?.(error);
  };

  markCreating(workspace, spec);
  handlers.onPhase?.("image");

  for (let tries = 1; ; tries++) {
    const result = await attempt(spec, phase);
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
