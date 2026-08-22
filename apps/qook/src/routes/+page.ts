import { redirect } from "@sveltejs/kit";
import { ApiError, api } from "$lib/api";
import {
  loadSandboxStore,
  OP_STALE_MS,
  saveSandboxStore,
} from "$lib/sandboxStore";
import type { LaunchPhase, SandboxInfo, SandboxSpec } from "$lib/types";
import type { PageLoad } from "./$types";

/**
 * One row type for the table. Modal only knows about running sandboxes; the
 * other three states come from the browser's own memory of what it launched.
 */
export type Row =
  | { kind: "running"; sb: SandboxInfo; stopping: boolean }
  | {
      kind: "creating";
      spec: SandboxSpec;
      startedAt: string;
      phase: LaunchPhase | null;
    }
  | { kind: "failed"; spec: SandboxSpec; error: string }
  | { kind: "stopped"; spec: SandboxSpec; stoppedAt: string };

export const load: PageLoad = async ({ fetch, depends, parent }) => {
  depends("app:sandboxes");
  const { connection } = await parent();
  try {
    const { sandboxes } = await api<{ sandboxes: SandboxInfo[] }>(
      "/api/sandboxes",
      {},
      fetch,
    );

    // Reconcile the browser's memory with Modal's truth. Running sandboxes are
    // (re)recorded and settle any pending op; a recorded sandbox that is no
    // longer running becomes a stopped row that can be recreated (name-keyed
    // state means recreating is resuming).
    const workspace = connection?.workspace ?? "default";
    const store = loadSandboxStore(workspace);
    const running = new Map(sandboxes.map((sb) => [sb.name, sb]));

    for (const sb of sandboxes) {
      const { sandboxId: _id, createdAt, ...spec } = sb;
      const record = store[sb.name];
      store[sb.name] = {
        spec,
        createdAt: record?.createdAt ?? createdAt,
        stoppedAt: null,
        // A running sandbox settles a pending launch; a pending terminate
        // stays pending until it actually leaves the list.
        op: record?.op?.kind === "stopping" ? record.op : null,
        error: null,
      };
    }

    const now = Date.now();
    for (const [name, record] of Object.entries(store)) {
      if (running.has(name)) continue;
      if (record.op?.kind === "stopping") {
        // Gone from the list — the terminate landed.
        record.op = null;
        record.stoppedAt = record.stoppedAt ?? new Date().toISOString();
        continue;
      }
      if (record.op?.kind === "creating") {
        const waited = now - new Date(record.op.startedAt).getTime();
        if (waited < OP_STALE_MS) continue; // still launching
        record.op = null;
        record.error =
          "Still not running 8 minutes after launch. Modal may have rejected it — retrying is safe.";
        continue;
      }
      record.stoppedAt = record.stoppedAt ?? new Date().toISOString();
    }
    saveSandboxStore(workspace, store);

    const rows: Row[] = sandboxes.map((sb) => ({
      kind: "running" as const,
      sb,
      stopping: store[sb.name]?.op?.kind === "stopping",
    }));
    for (const record of Object.values(store)) {
      const name = record.spec.name;
      if (running.has(name)) continue;
      if (record.op?.kind === "creating") {
        rows.push({
          kind: "creating",
          spec: record.spec,
          startedAt: record.op.startedAt,
          phase: record.op.phase,
        });
      } else if (record.error) {
        rows.push({ kind: "failed", spec: record.spec, error: record.error });
      } else {
        // A row that never ran has no stop time — fall back to when it was
        // recorded, so dismissing an error can't make the row disappear.
        rows.push({
          kind: "stopped",
          spec: record.spec,
          stoppedAt: record.stoppedAt ?? record.createdAt,
        });
      }
    }

    return { rows, workspace };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect(307, "/connect");
    throw e;
  }
};
