/**
 * Browser-side memory of sandboxes, keyed by workspace then name. Modal only
 * lists *running* sandboxes, so this store is what lets terminated ones stay
 * in the table as "stopped" rows that can be recreated (name-keyed state
 * makes recreation a resume). localStorage only — another browser won't see
 * these rows, same trust model as the credentials.
 */

import type { SandboxSpec } from "$lib/types";

export interface StoredSandbox {
  spec: SandboxSpec;
  createdAt: string;
  stoppedAt: string | null;
}

export type SandboxStore = Record<string, StoredSandbox>;

const key = (workspace: string) => `qook-sandboxes:${workspace}`;

export function loadSandboxStore(workspace: string): SandboxStore {
  try {
    return JSON.parse(localStorage.getItem(key(workspace)) ?? "{}");
  } catch {
    return {};
  }
}

export function saveSandboxStore(workspace: string, store: SandboxStore): void {
  localStorage.setItem(key(workspace), JSON.stringify(store));
}

export function markStopped(workspace: string, name: string): void {
  const store = loadSandboxStore(workspace);
  if (store[name] && store[name].stoppedAt === null) {
    store[name].stoppedAt = new Date().toISOString();
    saveSandboxStore(workspace, store);
  }
}

export function forgetSandbox(workspace: string, name: string): void {
  const store = loadSandboxStore(workspace);
  delete store[name];
  saveSandboxStore(workspace, store);
}
