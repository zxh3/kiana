/**
 * Modal control-plane boundary — stateless.
 *
 * There is no database and no server-side session: every request carries the
 * user's Modal credentials (x-modal-* headers, filled from the browser's
 * localStorage), or the server falls back to MODAL_TOKEN_ID /
 * MODAL_TOKEN_SECRET / MODAL_ENVIRONMENT env vars (deployment mode).
 *
 * Modal is the single source of truth: the sandbox list is
 * `sandboxes.list()` filtered by the `kitchen` tag, the spec (image, cpu,
 * memory, gpu, volumes, created-at) lives in tags, and the per-sandbox pane
 * secret is derived — HMAC(tokenSecret, name) — so nothing needs storing
 * anywhere. State persists as snapshots (see snapshots.ts), so a
 * sandbox's filesystem outlives the sandbox without any volume plumbing.
 */

import { createHmac } from "node:crypto";
import {
  AlreadyExistsError,
  type Image,
  InvalidError,
  ModalClient,
  NotFoundError,
  type Sandbox,
  type Volume,
} from "modal";
import { env } from "$env/dynamic/private";
import {
  bootScript,
  modePorts,
  runtimeCommands,
  runtimePorts,
} from "$lib/server/runtime";
import {
  imageForSnapshot,
  listSnapshots,
  readRetention,
  type SnapshotContext,
  saveSnapshot,
} from "$lib/server/snapshots";
import {
  type OpPhase,
  type SandboxInfo,
  type SandboxList,
  type SandboxSpec,
  type SessionInfo,
  type Snapshot,
  type StoppedSandbox,
  sessionModes,
  type VolumeMount,
} from "$lib/types";

export const APP_NAME = "kitchen";
/** Modal's maximum sandbox lifetime. The default would be 5 minutes. */
const SANDBOX_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export interface ModalCredentials {
  tokenId: string;
  tokenSecret: string;
  environment?: string;
}

/** Credentials from request headers, else server env vars, else null. */
export function credentialsFrom(request: Request): ModalCredentials | null {
  const tokenId = request.headers.get("x-modal-token-id");
  const tokenSecret = request.headers.get("x-modal-token-secret");
  const environment = request.headers.get("x-modal-environment") ?? undefined;
  if (tokenId && tokenSecret) return { tokenId, tokenSecret, environment };
  if (env.MODAL_TOKEN_ID && env.MODAL_TOKEN_SECRET) {
    return {
      tokenId: env.MODAL_TOKEN_ID,
      tokenSecret: env.MODAL_TOKEN_SECRET,
      environment: env.MODAL_ENVIRONMENT || undefined,
    };
  }
  return null;
}

/** Does the server itself carry credentials (deployment mode)? */
export function hasServerCredentials(): boolean {
  return Boolean(env.MODAL_TOKEN_ID && env.MODAL_TOKEN_SECRET);
}

/**
 * Everything Modal-side lives in the environment configured in Settings —
 * apps, sandboxes, volumes and snapshot images alike. The client carries
 * it as its default, and calls that accept an environment are given it
 * explicitly so containment is visible at each call site rather than implied.
 */
function clientFor(creds: ModalCredentials): ModalClient {
  return new ModalClient({
    tokenId: creds.tokenId,
    tokenSecret: creds.tokenSecret,
    environment: creds.environment || undefined,
  });
}

/** The environment as Modal wants it: undefined means the workspace default. */
function envOf(creds: ModalCredentials): string | undefined {
  return creds.environment || undefined;
}

function contextOf(
  creds: ModalCredentials,
  client: ModalClient,
): SnapshotContext {
  return { client, environment: envOf(creds) };
}

/**
 * The pane auth secret is derived, never stored. Keyed by sandbox NAME (not
 * id) so it exists before create and can be injected as boot env.
 */
export function paneSecret(creds: ModalCredentials, name: string): string {
  return createHmac("sha256", creds.tokenSecret)
    .update(`kitchen-pane:${name}`)
    .digest("base64url");
}

export type VerifyResult =
  | { ok: true; workspace: string }
  | { ok: false; error: string };

export async function verifyToken(
  creds: ModalCredentials,
): Promise<VerifyResult> {
  if (!creds.tokenId.startsWith("ak-")) {
    return {
      ok: false,
      error:
        "Token ID should look like ak-… — copy it from Modal → Settings → API tokens.",
    };
  }
  if (!creds.tokenSecret.startsWith("as-")) {
    return {
      ok: false,
      error:
        "Token secret should look like as-… — create a new token if you no longer have it.",
    };
  }
  const client = clientFor(creds);
  try {
    const who = await client.cpClient.workspaceNameLookup({});
    return {
      ok: true,
      workspace: who.username || who.workspaceName || "unknown",
    };
  } catch {
    return {
      ok: false,
      error:
        "Modal rejected this token — check both halves, or create a new one in Modal → Settings → API tokens.",
    };
  } finally {
    client.close();
  }
}

export type { SandboxInfo, SandboxSpec, SessionInfo, VolumeMount };

export function gpuSpec(
  gpu: string | null,
  gpuCount: number,
): string | undefined {
  if (!gpu) return undefined;
  return gpuCount > 1 ? `${gpu}:${gpuCount}` : gpu;
}

function specToTags(spec: SandboxSpec, createdAt: string) {
  return {
    kitchen: "1",
    "kitchen-name": spec.name,
    "kitchen-image": spec.image,
    "kitchen-cpu": String(spec.cpu),
    "kitchen-memory": String(spec.memoryGib),
    "kitchen-gpu": spec.gpu ?? "",
    "kitchen-gpu-count": String(spec.gpuCount),
    "kitchen-volumes": JSON.stringify(spec.volumes),
    "kitchen-created": createdAt,
  };
}

function tagsToInfo(
  sandboxId: string,
  tags: Record<string, string>,
): SandboxInfo | null {
  if (tags.kitchen !== "1") return null;
  let volumes: VolumeMount[] = [];
  try {
    volumes = JSON.parse(tags["kitchen-volumes"] ?? "[]");
  } catch {
    // tag got mangled — the mounts are cosmetic here, keep going
  }
  return {
    sandboxId,
    name: tags["kitchen-name"] ?? sandboxId,
    image: tags["kitchen-image"] ?? "unknown",
    cpu: Number(tags["kitchen-cpu"] ?? 0),
    memoryGib: Number(tags["kitchen-memory"] ?? 0),
    gpu: tags["kitchen-gpu"] || null,
    gpuCount: Number(tags["kitchen-gpu-count"] ?? 1),
    volumes,
    createdAt: tags["kitchen-created"] ?? new Date(0).toISOString(),
  };
}

/**
 * Every sandbox this app knows about, running or finished.
 *
 * `sandboxList` with `includeFinished` returns terminated sandboxes *with their
 * tags* — so a stopped sandbox's shape (cpu, memory, gpu, image, mounts) and
 * the moment it stopped are Modal's facts, not something a browser has to
 * remember. That is what lets two browsers with the same credentials see the
 * same list.
 *
 * One name is reused across runs, so only the newest record per name survives:
 * that is the sandbox as it last existed.
 */
export async function listSandboxes(
  creds: ModalCredentials,
): Promise<SandboxList> {
  const client = clientFor(creds);
  try {
    const app = await client.apps.fromName(APP_NAME, {
      createIfMissing: true,
      environment: envOf(creds),
    });
    const res = await client.cpClient.sandboxList({
      appId: app.appId,
      beforeTimestamp: 0,
      environmentName: envOf(creds) ?? "",
      includeFinished: true,
      tags: [{ tagName: "kitchen", tagValue: "1" }],
    });

    const newest = new Map<
      string,
      { info: SandboxInfo; finishedAt: string | null; createdAtMs: number }
    >();
    for (const sb of res.sandboxes) {
      const tags = Object.fromEntries(
        sb.tags.map((t) => [t.tagName, t.tagValue]),
      );
      const info = tagsToInfo(sb.id, tags);
      if (!info) continue;
      const finished = sb.taskInfo?.finishedAt;
      const record = {
        info,
        finishedAt: finished ? new Date(finished * 1000).toISOString() : null,
        createdAtMs: sb.createdAt * 1000,
      };
      const existing = newest.get(info.name);
      if (!existing || record.createdAtMs > existing.createdAtMs) {
        newest.set(info.name, record);
      }
    }

    const running: SandboxInfo[] = [];
    const stopped: StoppedSandbox[] = [];
    for (const record of newest.values()) {
      if (record.finishedAt === null) running.push(record.info);
      else stopped.push({ ...record.info, stoppedAt: record.finishedAt });
    }
    return {
      running: running.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      stopped: stopped.sort((a, b) => b.stoppedAt.localeCompare(a.stoppedAt)),
    };
  } finally {
    client.close();
  }
}

/**
 * Long image builds ride a single gRPC stream that intermediaries sometimes
 * cut (UNAVAILABLE / ECONNRESET). Completed layers are cached server-side, so
 * a retry resumes near where the stream died instead of rebuilding.
 */
function isTransient(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /UNAVAILABLE|ECONNRESET|ETIMEDOUT|EPIPE|socket hang up|DEADLINE_EXCEEDED|INTERNAL/i.test(
    msg,
  );
}

async function withRetry<T>(
  attempts: number,
  fn: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= attempts || !isTransient(e)) throw e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

export interface LaunchOptions {
  /** Boot from this snapshot instead of a freshly built image. */
  fromSnapshot?: string;
  /** Lineage recorded on a fork, for the UI to show. */
  forkedFrom?: string;
  /** Ignore any snapshots and build a new machine. */
  fresh?: boolean;
}

/**
 * A snapshot whose image Modal no longer has.
 *
 * Modal has no unpublish, so a deleted snapshot's tag keeps listing and even
 * resolves; the truth only arrives at `SandboxCreate`. An expired image says
 * so distinctly, which is worth telling apart from a deletion.
 */
function isMissingImage(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /NOT_FOUND: Image|has expired/i.test(msg);
}

/** Thrown when every snapshot a sandbox has is gone. */
export class NoUsableSnapshotError extends Error {
  constructor(name: string, image: string) {
    super(
      `None of ${name}'s snapshots can be used any more — they were deleted or have expired. Start fresh to launch it as a new machine from ${image}; its saved state is gone either way.`,
    );
    this.name = "NoUsableSnapshotError";
  }
}

export async function launchSandbox(
  creds: ModalCredentials,
  spec: SandboxSpec,
  onPhase: (phase: OpPhase) => void = () => {},
  options: LaunchOptions = {},
): Promise<{ sandboxId: string }> {
  const client = clientFor(creds);
  try {
    const app = await client.apps.fromName(APP_NAME, {
      createIfMissing: true,
      environment: envOf(creds),
    });
    const ctx = contextOf(creds, client);

    // Volumes are the user's own choice now, never a runtime mechanism. Their
    // contents stay out of snapshots, which is exactly why someone would
    // mount one. Resolved once: every attempt below mounts the same ones.
    const volumes: Record<string, Volume> = {};
    if (spec.volumes.length > 0) {
      onPhase("volumes");
      for (const { name, mount } of spec.volumes) {
        volumes[mount] = await client.volumes.fromName(name, {
          createIfMissing: true,
          environment: envOf(creds),
        });
      }
    }

    const create = async (image: Image) => {
      onPhase("creating");
      const sandbox = await client.sandboxes.create(app, image, {
        cpu: spec.cpu,
        memoryMiB: spec.memoryGib * 1024,
        gpu: gpuSpec(spec.gpu, spec.gpuCount),
        timeoutMs: SANDBOX_TIMEOUT_MS,
        command: ["/bin/bash", "-c", bootScript],
        env: {
          KITCHEN_SECRET: paneSecret(creds, spec.name),
          KITCHEN_SANDBOX_NAME: spec.name,
          KITCHEN_VOLUMES: spec.volumes
            .map((v) => `${v.name} -> ${v.mount}`)
            .join(", "),
        },
        encryptedPorts: [...runtimePorts],
        volumes,
        // Modal enforces name uniqueness among running sandboxes in the App.
        name: spec.name,
        tags: {
          ...specToTags(spec, new Date().toISOString()),
          ...(options.forkedFrom
            ? { "kitchen-forked-from": options.forkedFrom }
            : {}),
        },
      });
      return { sandboxId: sandbox.sandboxId };
    };

    const buildFresh = async () => {
      onPhase("image");
      return create(
        await withRetry(3, () =>
          client.images
            .fromRegistry(spec.image)
            .dockerfileCommands(runtimeCommands)
            .build(app),
        ),
      );
    };

    // An explicitly chosen snapshot is not something to silently substitute: the
    // caller asked for that state, so a missing image is an error.
    if (options.fromSnapshot) {
      onPhase("resolving");
      return await create(await imageForSnapshot(ctx, options.fromSnapshot));
    }

    if (options.fresh) return await buildFresh();

    // Starting an existing sandbox means booting its newest snapshot —
    // the whole machine as it was, in one create call. Snapshots whose image has
    // been deleted or has expired are skipped rather than fatal, because their
    // tags outlive them and would otherwise make the sandbox unstartable.
    onPhase("resolving");
    const snapshots = await listSnapshots(ctx, spec.name);
    for (const snapshot of snapshots) {
      try {
        return await create(await imageForSnapshot(ctx, snapshot.tag));
      } catch (e) {
        if (!isMissingImage(e)) throw e;
      }
    }

    // No snapshot ever existed: a brand new sandbox, so build its runtime. But if
    // snapshots existed and none worked, the saved state is gone — say so instead
    // of quietly handing back an empty machine under a familiar name.
    if (snapshots.length > 0) {
      throw new NoUsableSnapshotError(spec.name, spec.image);
    }
    return await buildFresh();
  } finally {
    client.close();
  }
}

/**
 * Save a snapshot of a running sandbox and leave it running.
 *
 * The sandbox has to be alive for a snapshot, which makes this the only way to
 * capture work *before* something ends the sandbox for you.
 */
export async function saveRunningSandbox(
  creds: ModalCredentials,
  sandboxId: string,
  options: { label?: string },
  onPhase: (phase: OpPhase) => void = () => {},
): Promise<Snapshot> {
  const client = clientFor(creds);
  try {
    const ctx = contextOf(creds, client);
    const sandbox = await client.sandboxes.fromId(sandboxId);
    const name = (await sandbox.getTags())["kitchen-name"] ?? sandboxId;
    return await saveSnapshot(
      ctx,
      sandbox,
      name,
      { ...options, retentionDays: await readRetention(ctx) },
      onPhase,
    );
  } finally {
    client.close();
  }
}

/**
 * Stop a sandbox, saving a snapshot first unless the caller discards it.
 * The snapshot has to happen while the sandbox is alive, so a failure here
 * aborts the stop — losing state silently would be worse than staying up.
 */
export async function stopSandbox(
  creds: ModalCredentials,
  sandboxId: string,
  options: { save: boolean; label?: string },
  onPhase: (phase: OpPhase) => void = () => {},
): Promise<{ snapshot: Snapshot | null }> {
  const client = clientFor(creds);
  try {
    let sandbox: Sandbox;
    try {
      sandbox = await client.sandboxes.fromId(sandboxId);
    } catch (e) {
      if (e instanceof NotFoundError || e instanceof InvalidError) {
        return { snapshot: null }; // already gone
      }
      throw e;
    }

    let snapshot: Snapshot | null = null;
    if (options.save) {
      const ctx = contextOf(creds, client);
      const name = (await sandbox.getTags())["kitchen-name"] ?? sandboxId;
      snapshot = await saveSnapshot(
        ctx,
        sandbox,
        name,
        { retentionDays: await readRetention(ctx), label: options.label },
        onPhase,
      );
    }

    onPhase("stopping");
    await sandbox.terminate();
    return { snapshot };
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof InvalidError) {
      return { snapshot: null };
    }
    throw e;
  } finally {
    client.close();
  }
}

/** Is the pane's service answering behind its tunnel yet? */
async function paneIsReady(authUrl: string): Promise<boolean> {
  try {
    const res = await fetch(authUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(2500),
    });
    return res.status === 302;
  } catch {
    return false;
  }
}

/** Live session detail: spec from tags, tunnels + readiness per pane. Null if the sandbox is gone. */
export async function getSession(
  creds: ModalCredentials,
  sandboxId: string,
): Promise<SessionInfo | null> {
  const client = clientFor(creds);
  try {
    let sandbox: Sandbox;
    try {
      sandbox = await client.sandboxes.fromId(sandboxId);
    } catch (e) {
      if (e instanceof NotFoundError || e instanceof InvalidError) return null;
      throw e;
    }
    const [tags, exitCode] = await Promise.all([
      sandbox.getTags(),
      sandbox.poll(),
    ]);
    if (exitCode !== null) return null; // ended — only live sandboxes exist here
    const info = tagsToInfo(sandboxId, tags);
    if (!info) return null;

    const tunnels = await sandbox.tunnels();
    const secret = paneSecret(creds, info.name);
    const paneEntries = await Promise.all(
      sessionModes.map(async (mode) => {
        const tunnel = tunnels[modePorts[mode]];
        const url = `${tunnel.url}/kitchen-auth?token=${secret}`;
        return [mode, { url, ready: await paneIsReady(url) }] as const;
      }),
    );
    return {
      sandbox: info,
      panes: Object.fromEntries(paneEntries) as SessionInfo["panes"],
    };
  } finally {
    client.close();
  }
}

/** One line for the UI when a Modal call fails: cause first, then the fix. */
export function modalErrorMessage(e: unknown): string {
  // Our own diagnosis, not Modal's — pass it through unprefixed.
  if (e instanceof NoUsableSnapshotError) return e.message;
  if (e instanceof AlreadyExistsError) {
    return "A sandbox with that name is already running — pick another name.";
  }
  const detail = e instanceof Error ? e.message : String(e);
  if (/has expired/.test(detail)) {
    return "That snapshot has expired. Start from an earlier snapshot, or start fresh from the base image.";
  }
  if (/NOT_FOUND: Image/.test(detail)) {
    return "That snapshot is no longer available — it was deleted.";
  }
  return `Modal returned an error: ${detail}`;
}
