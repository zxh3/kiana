import { redirect } from "@sveltejs/kit";
import { ApiError, api } from "$lib/api";
import { collapseTwins } from "$lib/points";
import { hiddenPoints } from "$lib/restorePoints";
import { RUNTIME_VERSION } from "$lib/runtimeVersion";
import {
  loadSandboxStore,
  OP_STALE_MS,
  saveSandboxStore,
} from "$lib/sandboxStore";
import type { OpPhase, SandboxInfo, SandboxSpec } from "$lib/types";
import type { PageLoad } from "./$types";

/**
 * One row type for the table. Modal only knows about running sandboxes; the
 * other three states come from the browser's own memory of what it launched.
 */
export type Row =
  | { kind: "running"; sb: SandboxInfo; stopping: boolean; points: number }
  | {
      kind: "creating";
      spec: SandboxSpec;
      startedAt: string;
      phase: OpPhase | null;
      points: number;
    }
  | { kind: "failed"; spec: SandboxSpec; error: string; points: number }
  | {
      kind: "stopped";
      spec: SandboxSpec;
      /** When its newest point was captured, else when this browser saw it stop. */
      stoppedAt: string;
      points: number;
    };

export const load: PageLoad = async ({ fetch, depends, parent }) => {
  depends("app:sandboxes");
  const { connection } = await parent();
  try {
    // Modal knows what is running; the restore-point summary says what each
    // sandbox can go back to, and when its state was last captured — so the
    // browser does not have to remember either.
    const [{ sandboxes }, { summary }] = await Promise.all([
      api<{ sandboxes: SandboxInfo[] }>("/api/sandboxes", {}, fetch),
      api<{
        summary: {
          sandbox: string;
          points: { tag: string; createdAt: string; kind: "auto" | "keep" }[];
        }[];
      }>("/api/restore-points", {}, fetch).catch(() => ({ summary: [] })),
    ]);

    // Points this browser deleted are still listed by Modal, so filter them
    // out here — otherwise a row would advertise points that fail on use.
    const workspace = connection?.workspace ?? "default";
    const deleted = hiddenPoints(workspace);
    const points = new Map(
      summary.map((entry) => {
        // Same collapse the drawer applies, so the count matches the list.
        const live = collapseTwins(
          entry.points.filter((p) => !deleted.includes(p.tag)),
        );
        return [
          entry.sandbox,
          {
            count: live.length,
            newestAt: live.reduce<string | null>(
              (newest, p) =>
                !newest || p.createdAt > newest ? p.createdAt : newest,
              null,
            ),
            // Every tag, collapsed twins included: what to forget when a start
            // proves none of them work any more.
            tags: entry.points.map((p) => p.tag),
          },
        ];
      }),
    );

    // Reconcile the browser's memory with Modal's truth. Running sandboxes are
    // (re)recorded and settle any pending op; a recorded sandbox that is no
    // longer running becomes a stopped row that can be recreated (name-keyed
    // state means recreating is resuming).
    const store = loadSandboxStore(workspace);
    const running = new Map(sandboxes.map((sb) => [sb.name, sb]));

    for (const sb of sandboxes) {
      const { sandboxId: _id, createdAt, ...spec } = sb;
      const record = store[sb.name];
      store[sb.name] = {
        spec,
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
      points: points.get(sb.name)?.count ?? 0,
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
          points: points.get(name)?.count ?? 0,
        });
      } else if (record.error) {
        rows.push({
          kind: "failed",
          spec: record.spec,
          error: record.error,
          points: points.get(name)?.count ?? 0,
        });
      } else {
        // Prefer Modal's own answer for "when did this stop": the newest
        // point's capture time. The stored one only covers a sandbox stopped
        // with its changes discarded, which writes no point.
        rows.push({
          kind: "stopped",
          spec: record.spec,
          stoppedAt:
            points.get(name)?.newestAt ??
            record.stoppedAt ??
            new Date().toISOString(),
          points: points.get(name)?.count ?? 0,
        });
      }
    }

    return {
      rows,
      workspace,
      runtimeVersion: RUNTIME_VERSION,
      pointTags: Object.fromEntries(
        [...points.entries()].map(([name, p]) => [name, p.tags]),
      ),
    };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect(307, "/connect");
    throw e;
  }
};
