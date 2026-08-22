/**
 * Restore points: kitchen's whole persistence model.
 *
 * A restore point is a filesystem snapshot of a sandbox, published under a
 * stable tag so it outlives the sandbox and is visible to any browser holding
 * the same Modal credentials. Nothing about persistence is stored by kitchen
 * itself — Modal's published image tags *are* the record.
 *
 *   kitchen-snap-<sandbox>:<retention>.r<runtime>.<stamp>[.<label>]
 *
 * The tag carries what the API cannot tell us afterwards. An image's TTL is
 * write-only (set at snapshot time, never readable, never changeable), so the
 * retention that was actually chosen is encoded in the tag and expiry is
 * derived from the image's creation time. Encoding the duration rather than
 * just the class keeps old points truthful when the policy later changes.
 */

import { type Image, ModalClient, type Sandbox } from "modal";
import { APP_NAME, type ModalCredentials } from "$lib/server/modal";
import { RUNTIME_VERSION } from "$lib/server/runtime";
import type { RestorePoint, RetentionDays } from "$lib/types";

/**
 * Everything here is scoped to one Modal environment — the one configured in
 * Settings. The client carries it as its default, but the raw `imageListTags`
 * RPC does not inherit that: an empty `environmentName` resolves to the
 * *workspace* default, which for an environment-scoped token is a permission
 * error rather than a fallback. So the environment travels explicitly, and
 * every call that accepts one is given it.
 */
export interface SnapshotContext {
  client: ModalClient;
  /** Undefined means "the workspace default", which is Modal's own fallback. */
  environment: string | undefined;
}

/** Callers own the client's lifetime and must `close()` it. */
export function snapshotContext(creds: ModalCredentials): SnapshotContext {
  const environment = creds.environment || undefined;
  return {
    client: new ModalClient({
      tokenId: creds.tokenId,
      tokenSecret: creds.tokenSecret,
      environment,
    }),
    environment,
  };
}

const TAG_PREFIX = "kitchen-snap-";
const DAY_MS = 24 * 60 * 60 * 1000;
/** Snapshotting a large filesystem outlasts the SDK's 55s default. */
const SNAPSHOT_TIMEOUT_MS = 5 * 60 * 1000;

/** `2026-08-22t14:30:52Z` → `20260822t143052`, the tag's sortable stamp. */
function stamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "")
    .toLowerCase();
}

/**
 * Inverse of `stamp`. This is the moment the machine state was captured, which
 * is not always the moment the tag was published — keeping a point republishes
 * the same state under a new tag, and it must not jump the queue as a result.
 */
function parseStamp(value: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})t(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${sec}Z`);
}

/**
 * Labels become part of an image tag, which accepts only alphanumerics,
 * dashes, periods, and underscores. Periods are the field separator here, so
 * they are folded into dashes too.
 */
export function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function imageName(sandbox: string): string {
  return `${TAG_PREFIX}${sandbox}`;
}

/**
 * `keep` covers both a labelled point and the "forever" retention policy —
 * anything with no expiry. Only a point that really does expire encodes days,
 * because that is the number the UI needs to derive an expiry from.
 */
function buildTag(
  sandbox: string,
  retentionDays: RetentionDays,
  label: string,
  now: Date,
): string {
  const keepForever = Boolean(label) || retentionDays === null;
  const fields = [
    keepForever ? "keep" : `a${retentionDays}d`,
    `r${RUNTIME_VERSION}`,
    stamp(now),
  ];
  if (label) fields.push(label);
  return `${imageName(sandbox)}:${fields.join(".")}`;
}

/** Inverse of `buildTag`. Returns null for tags kitchen did not write. */
export function parseTag(
  tag: string,
  imageId: string,
  publishedAt: Date,
): RestorePoint | null {
  const [name, version] = tag.split(":");
  if (!name?.startsWith(TAG_PREFIX) || !version) return null;
  const [retention, runtime, stampField = "", label = ""] = version.split(".");
  if (!retention || !runtime?.startsWith("r")) return null;
  // Order by when the state was captured, not when the tag was written.
  const createdAt = parseStamp(stampField) ?? publishedAt;

  const autoDays = /^a(\d+)d$/.exec(retention);
  const kind = retention === "keep" ? "keep" : autoDays ? "auto" : null;
  if (!kind) return null;

  return {
    tag,
    sandbox: name.slice(TAG_PREFIX.length),
    kind,
    label,
    runtime: Number(runtime.slice(1)),
    createdAt: createdAt.toISOString(),
    publishedAt: publishedAt.toISOString(),
    // The TTL Modal enforces runs from when the image was created, so expiry
    // is derived from that, not from the captured-state time.
    expiresAt: autoDays
      ? new Date(
          publishedAt.getTime() + Number(autoDays[1]) * DAY_MS,
        ).toISOString()
      : null,
    imageId,
  };
}

/**
 * Restore points for one sandbox, newest first, expired ones filtered out.
 *
 * Modal has no unpublish, so a tag outlives the image it pointed at and even
 * keeps resolving; only `SandboxCreate` reports the truth. Expiry is therefore
 * computed here rather than trusted from the API, and callers must still treat
 * a create-time `NOT_FOUND` as "this point is gone".
 */
export async function listRestorePoints(
  ctx: SnapshotContext,
  sandbox: string,
): Promise<RestorePoint[]> {
  const points: RestorePoint[] = [];
  let pageToken = "";
  do {
    const page = await ctx.client.cpClient.imageListTags({
      environmentName: ctx.environment ?? "",
      tagPrefix: `${imageName(sandbox)}:`,
      maxObjects: 100,
      pageToken,
    });
    for (const item of page.items) {
      const point = parseTag(
        item.tag,
        item.imageId,
        new Date(item.createdAt * 1000),
      );
      if (point) points.push(point);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  // Keeping a point republishes the same state, so the expiring original is
  // still listed. Collapse that twin — but only the automatic one: two kept
  // points at the same state are two deliberate bookmarks, both worth showing.
  const now = Date.now();
  const live = points.filter(
    (p) => !p.expiresAt || new Date(p.expiresAt).getTime() > now,
  );
  const keptStates = new Set(
    live.filter((p) => p.kind === "keep").map((p) => p.createdAt),
  );
  return live
    .filter((p) => p.kind === "keep" || !keptStates.has(p.createdAt))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The point a plain "Start" should boot from: the newest surviving one. */
export async function newestRestorePoint(
  ctx: SnapshotContext,
  sandbox: string,
): Promise<RestorePoint | null> {
  return (await listRestorePoints(ctx, sandbox))[0] ?? null;
}

/**
 * Snapshot a running sandbox and publish it as a restore point. A label makes
 * the point permanent (`ttlMs: null`); without one it expires on the
 * workspace's retention policy.
 */
export async function saveRestorePoint(
  ctx: SnapshotContext,
  sandbox: Sandbox,
  name: string,
  options: { retentionDays: RetentionDays; label?: string; now?: Date },
  onPhase: (phase: "snapshotting" | "publishing") => void = () => {},
): Promise<RestorePoint> {
  const label = options.label ? slugifyLabel(options.label) : "";
  const now = options.now ?? new Date();
  const keepForever = Boolean(label) || options.retentionDays === null;

  onPhase("snapshotting");
  const image = await sandbox.snapshotFilesystem({
    timeoutMs: SNAPSHOT_TIMEOUT_MS,
    ttlMs: keepForever ? null : (options.retentionDays as number) * DAY_MS,
  });

  onPhase("publishing");
  const tag = buildTag(name, options.retentionDays, label, now);
  await image.publish(tag, { environment: ctx.environment });

  const point = parseTag(tag, image.imageId, now);
  if (!point) throw new Error(`kitchen built an unparseable tag: ${tag}`);
  return point;
}

/**
 * Promote an automatic point to a kept one.
 *
 * A snapshot's TTL cannot be extended, but an image *derived* from it is an
 * ordinary build with no expiry — and stacking an empty layer takes seconds
 * because layers are referenced, not copied.
 */
export async function keepRestorePoint(
  ctx: SnapshotContext,
  point: RestorePoint,
  label: string,
  now = new Date(),
): Promise<RestorePoint> {
  const app = await ctx.client.apps.fromName(APP_NAME, {
    createIfMissing: true,
    environment: ctx.environment,
  });
  const source = await ctx.client.images.fromId(point.imageId);
  const kept = await source.dockerfileCommands(["RUN true"]).build(app);

  // Republish under the SAME captured-state stamp. Keeping a point changes
  // only its lifetime, so it must not become the newest point and quietly
  // change what a plain Start boots.
  // No name is fine: `keep.r<n>.<stamp>` is already unique, and the row then
  // reads as "automatic · KEPT" rather than carrying a synthetic label.
  const tag = buildTag(
    point.sandbox,
    null,
    slugifyLabel(label),
    new Date(point.createdAt),
  );
  await kept.publish(tag, { environment: ctx.environment });
  const result = parseTag(tag, kept.imageId, now);
  if (!result) throw new Error(`kitchen built an unparseable tag: ${tag}`);
  return result;
}

/** Resolve a restore point's tag to an image, ready to launch from. */
export async function imageForPoint(
  ctx: SnapshotContext,
  tag: string,
): Promise<Image> {
  const [name, version] = tag.split(":");
  return ctx.client.images.fromName(`${name}:${version}`, {
    environment: ctx.environment,
  });
}

export async function deleteRestorePoint(
  ctx: SnapshotContext,
  point: RestorePoint,
): Promise<void> {
  await ctx.client.images.delete(point.imageId);
}

/** Every point of a sandbox, deleted — used by Forget. */
export async function deleteAllRestorePoints(
  ctx: SnapshotContext,
  sandbox: string,
): Promise<number> {
  const points = await listRestorePoints(ctx, sandbox);
  const results = await Promise.allSettled(
    points.map((p) => ctx.client.images.delete(p.imageId)),
  );
  return results.filter((r) => r.status === "fulfilled").length;
}
