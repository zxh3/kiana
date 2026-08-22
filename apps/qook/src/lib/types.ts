export type SandboxStatus = "running" | "stopped" | "failed";

export const sessionModes = ["zsh", "herdr", "vscode", "browser"] as const;
export type SessionMode = (typeof sessionModes)[number];

export const cpuOptions = [2, 4, 8, 16, 32] as const;
export const gpuOptions = [
  "none",
  "T4",
  "L4",
  "A10G",
  "L40S",
  "A100",
  "A100-80GB",
  "H100",
  "H200",
  "B200",
  "B300",
] as const;
export const gpuCountOptions = [1, 2, 4, 8] as const;
export const imageOptions = [
  "ubuntu:24.04",
  "python:3.12",
  "node:22",
  "pytorch:2.4-cuda12.4",
] as const;
export const memoryRange = { min: 4, max: 128, step: 4 } as const;

export interface VolumeMount {
  name: string;
  mount: string;
}
export const maxVolumeMounts = 8;

/** Mount point of the per-sandbox state volume; everything under it persists. */
export const STATE_MOUNT = "/qook-state";
/** Where shells and code-server open; symlinked onto the state volume. */
export const WORKSPACE_DIR = "/workspace";
/** Paths the runtime owns — user volume mounts may not collide with these. */
export const reservedMountPaths: string[] = [STATE_MOUNT, WORKSPACE_DIR];

/** Public (tunneled) port per session mode. */
export const modePorts = {
  zsh: 7681,
  herdr: 7683,
  vscode: 8443,
  browser: 8080,
} as const;

/**
 * Everything the runtime persists on the state volume, relative to
 * `qook-state/sandboxes/<name>/`. Shown verbatim in the UI — keep in sync
 * with the boot script in server/runtime.ts.
 */
export const builtinMounts = [
  { sub: "workspace", target: "/workspace" },
  { sub: "herdr/config", target: "~/.config/herdr" },
  { sub: "herdr/share", target: "~/.local/share/herdr" },
  { sub: "herdr/state", target: "~/.local/state/herdr" },
  { sub: "code-server/user", target: "~/.local/share/code-server/User" },
  {
    sub: "code-server/extensions",
    target: "~/.local/share/code-server/extensions",
  },
  { sub: "agents/claude", target: "$CLAUDE_CONFIG_DIR" },
  { sub: "agents/codex", target: "$CODEX_HOME" },
  { sub: "agents/pi", target: "~/.pi" },
  { sub: "tools/cargo", target: "$CARGO_HOME" },
  { sub: "tools/rustup", target: "$RUSTUP_HOME" },
  { sub: "tools/npm", target: "npm -g prefix" },
  { sub: "bash_history", target: "$HISTFILE" },
] as const;

export interface SandboxInfo {
  sandboxId: string;
  name: string;
  image: string;
  cpu: number;
  memoryGib: number;
  gpu: string | null;
  gpuCount: number;
  volumes: VolumeMount[];
  createdAt: string; // ISO
}

export type SandboxSpec = Omit<SandboxInfo, "sandboxId" | "createdAt">;

export interface PaneInfo {
  url: string;
  ready: boolean;
}

export interface SessionInfo {
  sandbox: SandboxInfo;
  panes: Record<SessionMode, PaneInfo>;
}

/**
 * Launch progress. Creating a sandbox can take minutes — the first launch of
 * a base image builds the runtime — so POST /api/sandboxes streams these as
 * NDJSON instead of leaving the client on a blank spinner. `waiting` is the
 * window right after a terminate, while Modal still holds the name.
 */
export const launchPhases = [
  "image",
  "volumes",
  "creating",
  "waiting",
] as const;
export type LaunchPhase = (typeof launchPhases)[number];

export const launchPhaseLabels: Record<LaunchPhase, string> = {
  image: "building image",
  volumes: "attaching volumes",
  creating: "starting machine",
  waiting: "waiting for the name to free",
};

export type LaunchEvent =
  | { phase: LaunchPhase }
  | { sandboxId: string }
  | { error: string };

export interface ConnectionInfo {
  workspace: string;
  environment: string | null;
  source: "browser" | "server";
}
