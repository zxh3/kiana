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
 * anywhere. State persists as restore points (see snapshots.ts), so a
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
  imageForPoint,
  newestRestorePoint,
  type SnapshotContext,
  saveRestorePoint,
} from "$lib/server/snapshots";
import {
  type OpPhase,
  type RestorePoint,
  type RetentionDays,
  type SandboxInfo,
  type SandboxSpec,
  type SessionInfo,
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
 * apps, sandboxes, volumes and restore-point images alike. The client carries
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

export async function listSandboxes(
  creds: ModalCredentials,
): Promise<SandboxInfo[]> {
  const client = clientFor(creds);
  try {
    const app = await client.apps.fromName(APP_NAME, {
      createIfMissing: true,
      environment: envOf(creds),
    });
    const running: Sandbox[] = [];
    for await (const sb of client.sandboxes.list({
      appId: app.appId,
      tags: { kitchen: "1" },
    })) {
      running.push(sb);
    }
    const infos = await Promise.all(
      running.map(async (sb) => tagsToInfo(sb.sandboxId, await sb.getTags())),
    );
    return infos
      .filter((info) => info !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
  /** Boot from this restore point instead of a freshly built image. */
  fromPoint?: string;
  /** Lineage recorded on a fork, for the UI to show. */
  forkedFrom?: string;
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

    // Starting an existing sandbox means booting its newest restore point —
    // the whole machine as it was, in one create call. Only a sandbox with no
    // points left (or a brand new name) pays for an image build.
    onPhase("resolving");
    const ctx = contextOf(creds, client);
    const point = options.fromPoint
      ? options.fromPoint
      : (await newestRestorePoint(ctx, spec.name))?.tag;

    let image: Image;
    if (point) {
      image = await imageForPoint(ctx, point);
    } else {
      onPhase("image");
      image = await withRetry(3, () =>
        client.images
          .fromRegistry(spec.image)
          .dockerfileCommands(runtimeCommands)
          .build(app),
      );
    }

    // Volumes are the user's own choice now, never a runtime mechanism. Their
    // contents stay out of restore points, which is exactly why someone would
    // mount one.
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
  } finally {
    client.close();
  }
}

/**
 * Stop a sandbox, saving a restore point first unless the caller discards it.
 * The snapshot has to happen while the sandbox is alive, so a failure here
 * aborts the stop — losing state silently would be worse than staying up.
 */
export async function stopSandbox(
  creds: ModalCredentials,
  sandboxId: string,
  options: {
    save: boolean;
    retentionDays: RetentionDays;
    label?: string;
  },
  onPhase: (phase: OpPhase) => void = () => {},
): Promise<{ point: RestorePoint | null }> {
  const client = clientFor(creds);
  try {
    let sandbox: Sandbox;
    try {
      sandbox = await client.sandboxes.fromId(sandboxId);
    } catch (e) {
      if (e instanceof NotFoundError || e instanceof InvalidError) {
        return { point: null }; // already gone
      }
      throw e;
    }

    let point: RestorePoint | null = null;
    if (options.save) {
      const name = (await sandbox.getTags())["kitchen-name"] ?? sandboxId;
      point = await saveRestorePoint(
        contextOf(creds, client),
        sandbox,
        name,
        { retentionDays: options.retentionDays, label: options.label },
        onPhase,
      );
    }

    onPhase("stopping");
    await sandbox.terminate();
    return { point };
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof InvalidError) {
      return { point: null };
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
  if (e instanceof AlreadyExistsError) {
    return "A sandbox with that name is already running — pick another name.";
  }
  const detail = e instanceof Error ? e.message : String(e);
  if (/has expired/.test(detail)) {
    return "That restore point has expired. Start from an earlier point, or start fresh from the base image.";
  }
  if (/NOT_FOUND: Image/.test(detail)) {
    return "That restore point is no longer available — it was deleted.";
  }
  return `Modal returned an error: ${detail}`;
}
