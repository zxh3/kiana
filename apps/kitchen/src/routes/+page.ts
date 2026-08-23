import { redirect } from "@sveltejs/kit";
import { ApiError, api } from "$lib/api";
import { streaming } from "$lib/launch";
import { loadPending, markFailed, OP_STALE_MS } from "$lib/pending";
import { RUNTIME_VERSION } from "$lib/runtimeVersion";
import { visibleSnapshots } from "$lib/snapshots";
import type {
  OpPhase,
  SandboxInfo,
  SandboxSnapshots,
  SandboxSpec,
  StoppedSandbox,
} from "$lib/types";
import type { PageLoad } from "./$types";

/**
 * One row type for the table. Running and stopped sandboxes are both Modal's
 * facts — terminated sandboxes keep their tags, so a stopped row knows its own
 * shape and stop time. Only an operation still in flight is local to this tab.
 */
export type Row =
  | { kind: "running"; sb: SandboxInfo; stopping: boolean; snapshots: number }
  | {
      kind: "creating";
      spec: SandboxSpec;
      startedAt: string;
      phase: OpPhase | null;
      snapshots: number;
    }
  | { kind: "failed"; spec: SandboxSpec; error: string; snapshots: number }
  | {
      kind: "stopped";
      spec: SandboxSpec;
      stoppedAt: string;
      snapshots: number;
    };

export const load: PageLoad = async ({ fetch, depends, parent }) => {
  depends("app:sandboxes");
  const { connection } = await parent();
  try {
    // Everything shown comes from Modal: what is running, what has stopped
    // (with its shape and stop time), and what each sandbox can go back to.
    const [{ running, stopped }, { summary }] = await Promise.all([
      api<{ running: SandboxInfo[]; stopped: StoppedSandbox[] }>(
        "/api/sandboxes",
        {},
        fetch,
      ),
      api<{ summary: SandboxSnapshots[] }>("/api/snapshots", {}, fetch).catch(
        () => ({ summary: [] as SandboxSnapshots[] }),
      ),
    ]);

    const counts = new Map(
      summary.map((entry) => [
        entry.sandbox,
        visibleSnapshots(entry.snapshots).length,
      ]),
    );
    const countFor = (name: string) => counts.get(name) ?? 0;

    const workspace = connection?.workspace ?? "default";
    const pending = loadPending(workspace);
    const live = new Set(running.map((sb) => sb.name));
    const now = Date.now();

    const rows: Row[] = running.map((sb) => ({
      kind: "running" as const,
      sb,
      stopping: pending[sb.name]?.kind === "stopping",
      snapshots: countFor(sb.name),
    }));

    // A launch in flight has no sandbox yet, so it can only come from here.
    // Once Modal lists it, the local record is redundant and drops out.
    for (const [name, op] of Object.entries(pending)) {
      if (live.has(name)) continue;
      if (op.error) {
        rows.push({
          kind: "failed",
          spec: op.spec,
          error: op.error,
          snapshots: countFor(name),
        });
        continue;
      }
      if (op.kind !== "creating") continue;
      if (now - new Date(op.startedAt).getTime() < OP_STALE_MS) {
        rows.push({
          kind: "creating",
          spec: op.spec,
          startedAt: op.startedAt,
          // A launch this tab is not streaming (it was started elsewhere, or
          // survived a reload) cannot honestly report a build phase: all we
          // are doing is watching Modal's list for it to appear.
          phase: streaming.has(name) ? op.phase : "watching",
          snapshots: countFor(name),
        });
      } else {
        const message =
          "Still not running 8 minutes after launch. Modal may have rejected it — retrying is safe.";
        markFailed(workspace, name, message);
        rows.push({
          kind: "failed",
          spec: op.spec,
          error: message,
          snapshots: countFor(name),
        });
      }
    }

    // A stopped sandbox is worth listing when it has something to go back to.
    // Without snapshots there is nothing to resume, so it is history, not a row.
    for (const sb of stopped) {
      if (live.has(sb.name) || pending[sb.name]) continue;
      if (countFor(sb.name) === 0) continue;
      const { sandboxId: _id, createdAt: _created, stoppedAt, ...spec } = sb;
      rows.push({
        kind: "stopped",
        spec,
        stoppedAt,
        snapshots: countFor(sb.name),
      });
    }

    return { rows, workspace, runtimeVersion: RUNTIME_VERSION };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect(307, "/connect");
    throw e;
  }
};
