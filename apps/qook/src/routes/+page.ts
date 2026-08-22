import { redirect } from "@sveltejs/kit";
import { ApiError, api } from "$lib/api";
import { loadSandboxStore, saveSandboxStore } from "$lib/sandboxStore";
import type { SandboxInfo, SandboxSpec } from "$lib/types";
import type { PageLoad } from "./$types";

export interface StoppedRow {
  spec: SandboxSpec;
  createdAt: string;
  stoppedAt: string;
}

export const load: PageLoad = async ({ fetch, depends, parent }) => {
  depends("app:sandboxes");
  const { connection } = await parent();
  try {
    const { sandboxes } = await api<{ sandboxes: SandboxInfo[] }>(
      "/api/sandboxes",
      {},
      fetch,
    );

    // Reconcile the browser's memory with Modal's truth: running sandboxes
    // are (re)recorded; recorded ones that are no longer running become
    // stopped rows that can be recreated (name-keyed state resumes).
    const workspace = connection?.workspace ?? "default";
    const store = loadSandboxStore(workspace);
    const running = new Set(sandboxes.map((sb) => sb.name));
    for (const sb of sandboxes) {
      const { sandboxId: _id, createdAt, ...spec } = sb;
      store[sb.name] = {
        spec,
        createdAt: store[sb.name]?.createdAt ?? createdAt,
        stoppedAt: null,
      };
    }
    for (const [name, record] of Object.entries(store)) {
      if (!running.has(name) && record.stoppedAt === null) {
        record.stoppedAt = new Date().toISOString();
      }
    }
    saveSandboxStore(workspace, store);

    const stopped: StoppedRow[] = Object.values(store)
      .filter(
        (record): record is StoredStopped =>
          !running.has(record.spec.name) && record.stoppedAt !== null,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return { sandboxes, stopped, workspace };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect(307, "/connect");
    throw e;
  }
};

type StoredStopped = {
  spec: SandboxSpec;
  createdAt: string;
  stoppedAt: string;
};
