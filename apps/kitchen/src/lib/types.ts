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

/** Where shells and code-server open. An ordinary directory in the image. */
export const WORKSPACE_DIR = "/workspace";

/**
 * A sandbox name is also its identity across restarts, and it ends up in Modal
 * object names, so it stays conservative: lowercase, digits and dashes.
 */
export const maxSandboxNameLength = 32;
export const sandboxNamePattern = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** Public (tunneled) port per session mode. */
export const modePorts = {
  zsh: 7681,
  herdr: 7683,
  vscode: 8443,
  browser: 8080,
} as const;

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

/** A sandbox that has finished. Modal keeps its tags, so its shape survives. */
export interface StoppedSandbox extends SandboxInfo {
  /** When Modal recorded the task as finished. */
  stoppedAt: string;
}

export interface SandboxList {
  running: SandboxInfo[];
  stopped: StoppedSandbox[];
}

export interface PaneInfo {
  url: string;
  ready: boolean;
}

export interface SessionInfo {
  sandbox: SandboxInfo;
  panes: Record<SessionMode, PaneInfo>;
}

/**
 * A snapshot: one published snapshot image of a sandbox's filesystem.
 * `auto` snapshots expire on the workspace retention policy; `keep` snapshots are
 * held until deleted. Modal cannot report an image's TTL, so the retention is
 * encoded in the tag and `expiresAt` is derived from `createdAt`.
 */
export interface Snapshot {
  /** Full published tag, e.g. `kitchen-snap-api-work:keep.r2.20260822t1430.pre-refactor`. */
  tag: string;
  sandbox: string;
  kind: "auto" | "keep";
  /** User label for kept snapshots; empty for automatic ones. */
  label: string;
  /** Runtime version the snapshot was taken on. */
  runtime: number;
  /**
   * When the machine state was captured — the field snapshots are ordered by.
   * Keeping a snapshot republishes the same state, so this is deliberately not
   * the publish time.
   */
  createdAt: string;
  /** When this tag's image was created; what Modal measures the TTL from. */
  publishedAt: string;
  /** Null when the snapshot is kept indefinitely. */
  expiresAt: string | null;
  imageId: string;
}

/**
 * Progress for the two slow operations. Starting a sandbox can take minutes
 * (a first-time image build) and stopping one takes as long as its snapshot,
 * so both endpoints stream these as NDJSON rather than leaving the client on a
 * blank spinner. `waiting` is the window right after a terminate, while Modal
 * still holds the name.
 */
export const opPhases = [
  "resolving",
  "image",
  "volumes",
  "creating",
  "waiting",
  "watching",
  "snapshotting",
  "publishing",
  "stopping",
] as const;
export type OpPhase = (typeof opPhases)[number];

export const opPhaseLabels: Record<OpPhase, string> = {
  resolving: "finding snapshot",
  image: "building image",
  volumes: "attaching volumes",
  creating: "starting machine",
  waiting: "waiting for the name to free",
  watching: "lost contact — watching for it",
  snapshotting: "saving machine state",
  publishing: "saving snapshot",
  stopping: "stopping machine",
};

export type OpEvent =
  | { phase: OpPhase }
  | { sandboxId: string }
  | { snapshot: Snapshot }
  | { done: true }
  | { error: string };

/** Retention choices for automatic snapshots. Null keeps them forever. */
export const retentionOptions = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: null, label: "forever" },
] as const;
export type RetentionDays = (typeof retentionOptions)[number]["days"];
export const defaultRetentionDays: RetentionDays = 30;

export interface ConnectionInfo {
  workspace: string;
  environment: string | null;
  source: "browser" | "server";
}
