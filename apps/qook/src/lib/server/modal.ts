/**
 * Modal control-plane boundary — stateless.
 *
 * There is no database and no server-side session: every request carries the
 * user's Modal credentials (x-modal-* headers, filled from the browser's
 * localStorage), or the server falls back to MODAL_TOKEN_ID /
 * MODAL_TOKEN_SECRET / MODAL_ENVIRONMENT env vars (deployment mode).
 *
 * Modal is the single source of truth: the sandbox list is
 * `sandboxes.list()` filtered by the `qook` tag, the spec (image, cpu,
 * memory, gpu, volumes, created-at) lives in tags, and the per-sandbox pane
 * secret is derived — HMAC(tokenSecret, name) — so nothing needs storing
 * anywhere.
 */

import { createHmac } from "node:crypto";
import {
  AlreadyExistsError,
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
  STATE_MOUNT,
} from "$lib/server/runtime";
import {
  type SandboxInfo,
  type SandboxSpec,
  type SessionInfo,
  sessionModes,
  type VolumeMount,
} from "$lib/types";

const APP_NAME = "qook";
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

function clientFor(creds: ModalCredentials): ModalClient {
  return new ModalClient({
    tokenId: creds.tokenId,
    tokenSecret: creds.tokenSecret,
    environment: creds.environment,
  });
}

/**
 * The pane auth secret is derived, never stored. Keyed by sandbox NAME (not
 * id) so it exists before create and can be injected as boot env.
 */
export function paneSecret(creds: ModalCredentials, name: string): string {
  return createHmac("sha256", creds.tokenSecret)
    .update(`qook-pane:${name}`)
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
    qook: "1",
    "qook-name": spec.name,
    "qook-image": spec.image,
    "qook-cpu": String(spec.cpu),
    "qook-memory": String(spec.memoryGib),
    "qook-gpu": spec.gpu ?? "",
    "qook-gpu-count": String(spec.gpuCount),
    "qook-volumes": JSON.stringify(spec.volumes),
    "qook-created": createdAt,
  };
}

function tagsToInfo(
  sandboxId: string,
  tags: Record<string, string>,
): SandboxInfo | null {
  if (tags.qook !== "1") return null;
  let volumes: VolumeMount[] = [];
  try {
    volumes = JSON.parse(tags["qook-volumes"] ?? "[]");
  } catch {
    // tag got mangled — the mounts are cosmetic here, keep going
  }
  return {
    sandboxId,
    name: tags["qook-name"] ?? sandboxId,
    image: tags["qook-image"] ?? "unknown",
    cpu: Number(tags["qook-cpu"] ?? 0),
    memoryGib: Number(tags["qook-memory"] ?? 0),
    gpu: tags["qook-gpu"] || null,
    gpuCount: Number(tags["qook-gpu-count"] ?? 1),
    volumes,
    createdAt: tags["qook-created"] ?? new Date(0).toISOString(),
  };
}

export async function listSandboxes(
  creds: ModalCredentials,
): Promise<SandboxInfo[]> {
  const client = clientFor(creds);
  try {
    const app = await client.apps.fromName(APP_NAME, { createIfMissing: true });
    const running: Sandbox[] = [];
    for await (const sb of client.sandboxes.list({
      appId: app.appId,
      tags: { qook: "1" },
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

export async function launchSandbox(
  creds: ModalCredentials,
  spec: SandboxSpec,
): Promise<{ sandboxId: string }> {
  const client = clientFor(creds);
  try {
    const app = await client.apps.fromName(APP_NAME, { createIfMissing: true });
    // Base image + the qook runtime layer. Modal caches image builds by
    // layer content: the first launch per base image builds (~minutes),
    // every launch after reuses it.
    const image = await client.images
      .fromRegistry(spec.image)
      .dockerfileCommands(runtimeCommands)
      .build(app);

    // One shared state volume; subPaths are keyed by NAME so that creating a
    // sandbox with a previous name resumes its /workspace and herdr state.
    const stateVolume = await client.volumes.fromName("qook-state", {
      createIfMissing: true,
    });
    const volumes: Record<string, Volume> = {
      [STATE_MOUNT]: stateVolume.withMountOptions({
        subPath: `sandboxes/${spec.name}`,
      }),
    };
    for (const { name, mount } of spec.volumes) {
      volumes[mount] = await client.volumes.fromName(name, {
        createIfMissing: true,
      });
    }

    const sandbox = await client.sandboxes.create(app, image, {
      cpu: spec.cpu,
      memoryMiB: spec.memoryGib * 1024,
      gpu: gpuSpec(spec.gpu, spec.gpuCount),
      timeoutMs: SANDBOX_TIMEOUT_MS,
      command: ["/bin/bash", "-c", bootScript],
      env: {
        QOOK_SECRET: paneSecret(creds, spec.name),
        QOOK_SANDBOX_NAME: spec.name,
      },
      encryptedPorts: [...runtimePorts],
      volumes,
      // Modal enforces name uniqueness among running sandboxes in the App.
      name: spec.name,
      tags: specToTags(spec, new Date().toISOString()),
    });
    return { sandboxId: sandbox.sandboxId };
  } finally {
    client.close();
  }
}

export async function terminateSandbox(
  creds: ModalCredentials,
  sandboxId: string,
): Promise<void> {
  const client = clientFor(creds);
  try {
    const sandbox = await client.sandboxes.fromId(sandboxId);
    await sandbox.terminate();
  } catch (e) {
    // Already gone — that is the state we wanted.
    if (!(e instanceof NotFoundError || e instanceof InvalidError)) throw e;
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
        const url = `${tunnel.url}/qook-auth?token=${secret}`;
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
  return `Modal returned an error: ${detail}`;
}
