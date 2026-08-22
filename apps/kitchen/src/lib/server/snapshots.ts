/**
 * Snapshots: kitchen's whole persistence model.
 *
 * A snapshot is a filesystem snapshot of a sandbox, published under a
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
 * just the class keeps old snapshots truthful when the policy later changes.
 */

import { type Image, ModalClient, type Sandbox } from "modal";
import { APP_NAME, type ModalCredentials } from "$lib/server/modal";
import { RUNTIME_VERSION } from "$lib/server/runtime";
import {
  defaultRetentionDays,
  type RetentionDays,
  type Snapshot,
} from "$lib/types";

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
/**
 * Deleting a snapshot cannot remove its tag — Modal has no unpublish — but
 * republishing *replaces* what a tag points at. So a deleted snapshot's tag is
 * pointed at one shared marker image, which every browser can recognise. That
 * is what makes a deletion visible to everyone instead of only to the browser
 * that did it.
 */
const TOMBSTONE_TAG = "kitchen-deleted:v1";
/**
 * The retention policy, stored the same way: a tag whose *name* carries the
 * value. A workspace-level setting has to be shared — two browsers disagreeing
 * about how long new snapshots live would be a genuine inconsistency — and
 * published tags are the only server-side store this app has. Tags cannot be
 * removed, so each write adds a stamped one and the newest wins.
 */
const RETENTION_PREFIX = "kitchen-config:retention-";
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
 * is not always the moment the tag was published — keeping a snapshot republishes
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
 * `keep` covers both a labelled snapshot and the "forever" retention policy —
 * anything with no expiry. Only a snapshot that really does expire encodes days,
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
): Snapshot | null {
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
 * Snapshots for one sandbox: everything still alive, newest first.
 *
 * Deliberately *not* collapsed and not deduplicated. Only the browser knows
 * which snapshots it has deleted, and collapsing a kept snapshot's twin before
 * that filtering runs would hide the twin while still counting it — the two
 * have to happen in one order, in one place (see $lib/snapshots).
 *
 * Modal has no unpublish, so a tag outlives the image it pointed at and even
 * keeps resolving; only `SandboxCreate` reports the truth. Expiry is therefore
 * computed here rather than trusted from the API, and callers must still treat
 * a create-time `NOT_FOUND` as "this snapshot is gone".
 */
export async function listSnapshots(
  ctx: SnapshotContext,
  sandbox: string,
): Promise<Snapshot[]> {
  const deleted = await tombstoneId(ctx);
  const snapshots: Snapshot[] = [];
  let pageToken = "";
  do {
    const page = await ctx.client.cpClient.imageListTags({
      environmentName: ctx.environment ?? "",
      tagPrefix: `${imageName(sandbox)}:`,
      maxObjects: 100,
      pageToken,
    });
    for (const item of page.items) {
      if (item.imageId === deleted) continue;
      const snapshot = parseTag(
        item.tag,
        item.imageId,
        new Date(item.createdAt * 1000),
      );
      if (snapshot) snapshots.push(snapshot);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  const now = Date.now();
  return snapshots
    .filter((s) => !s.expiresAt || new Date(s.expiresAt).getTime() > now)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * One row per sandbox that has snapshots, for the table: how many snapshots
 * it has and when its newest state was captured. This is server-side truth the
 * browser would otherwise have to remember — a sandbox's last-stopped time and
 * whether it has anything to go back to.
 */
export interface SnapshotSummary {
  tag: string;
  createdAt: string;
  kind: Snapshot["kind"];
}

export async function snapshotSummary(
  ctx: SnapshotContext,
): Promise<{ sandbox: string; snapshots: SnapshotSummary[] }[]> {
  const deleted = await tombstoneId(ctx);
  const snapshots: Snapshot[] = [];
  let pageToken = "";
  do {
    const page = await ctx.client.cpClient.imageListTags({
      environmentName: ctx.environment ?? "",
      tagPrefix: TAG_PREFIX,
      maxObjects: 100,
      pageToken,
    });
    for (const item of page.items) {
      if (item.imageId === deleted) continue;
      const snapshot = parseTag(
        item.tag,
        item.imageId,
        new Date(item.createdAt * 1000),
      );
      if (snapshot) snapshots.push(snapshot);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  // Tags rather than a count, so the caller can collapse kept twins with the
  // same rule the drawer uses.
  const now = Date.now();
  const summary = new Map<string, SnapshotSummary[]>();
  for (const snapshot of snapshots) {
    if (snapshot.expiresAt && new Date(snapshot.expiresAt).getTime() <= now)
      continue;
    const entry = summary.get(snapshot.sandbox) ?? [];
    entry.push({
      tag: snapshot.tag,
      createdAt: snapshot.createdAt,
      kind: snapshot.kind,
    });
    summary.set(snapshot.sandbox, entry);
  }
  return [...summary.entries()].map(([sandbox, sandboxSnapshots]) => ({
    sandbox,
    snapshots: sandboxSnapshots,
  }));
}

/** The snapshot a plain "Start" should boot from: the newest surviving one. */
export async function newestSnapshot(
  ctx: SnapshotContext,
  sandbox: string,
): Promise<Snapshot | null> {
  return (await listSnapshots(ctx, sandbox))[0] ?? null;
}

/**
 * Snapshot a running sandbox and publish it as a snapshot. A label makes
 * the snapshot permanent (`ttlMs: null`); without one it expires on the
 * workspace's retention policy.
 */
export async function saveSnapshot(
  ctx: SnapshotContext,
  sandbox: Sandbox,
  name: string,
  options: { retentionDays: RetentionDays; label?: string; now?: Date },
  onPhase: (phase: "snapshotting" | "publishing") => void = () => {},
): Promise<Snapshot> {
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

  const snapshot = parseTag(tag, image.imageId, now);
  if (!snapshot) throw new Error(`kitchen built an unparseable tag: ${tag}`);
  return snapshot;
}

/**
 * Promote an automatic snapshot to a kept one.
 *
 * A snapshot's TTL cannot be extended, but an image *derived* from it is an
 * ordinary build with no expiry — and stacking an empty layer takes seconds
 * because layers are referenced, not copied.
 */
export async function keepSnapshot(
  ctx: SnapshotContext,
  snapshot: Snapshot,
  label: string,
  now = new Date(),
): Promise<Snapshot> {
  const app = await ctx.client.apps.fromName(APP_NAME, {
    createIfMissing: true,
    environment: ctx.environment,
  });
  const source = await ctx.client.images.fromId(snapshot.imageId);
  const kept = await source.dockerfileCommands(["RUN true"]).build(app);

  // Republish under the SAME captured-state stamp. Keeping a snapshot changes
  // only its lifetime, so it must not become the newest snapshot and quietly
  // change what a plain Start boots.
  // No name is fine: `keep.r<n>.<stamp>` is already unique, and the row then
  // reads as "automatic · KEPT" rather than carrying a synthetic label.
  const tag = buildTag(
    snapshot.sandbox,
    null,
    slugifyLabel(label),
    new Date(snapshot.createdAt),
  );
  await kept.publish(tag, { environment: ctx.environment });
  const result = parseTag(tag, kept.imageId, now);
  if (!result) throw new Error(`kitchen built an unparseable tag: ${tag}`);
  return result;
}

/**
 * The marker image deleted snapshots point at. Tiny, content-irrelevant, and
 * built once per environment (Modal caches it), so this is cheap to call.
 */
async function tombstone(ctx: SnapshotContext): Promise<Image> {
  try {
    return await ctx.client.images.fromName(TOMBSTONE_TAG, {
      environment: ctx.environment,
    });
  } catch {
    const app = await ctx.client.apps.fromName(APP_NAME, {
      createIfMissing: true,
      environment: ctx.environment,
    });
    const image = await ctx.client.images
      .fromRegistry("alpine:3.20")
      .build(app);
    await image.publish(TOMBSTONE_TAG, { environment: ctx.environment });
    return image;
  }
}

/** Id of the marker image, or null when nothing has ever been deleted. */
async function tombstoneId(ctx: SnapshotContext): Promise<string | null> {
  try {
    const image = await ctx.client.images.fromName(TOMBSTONE_TAG, {
      environment: ctx.environment,
    });
    return image.imageId;
  } catch {
    return null;
  }
}

/** The retention new automatic snapshots get. Defaults when never set. */
export async function readRetention(
  ctx: SnapshotContext,
): Promise<RetentionDays> {
  try {
    const page = await ctx.client.cpClient.imageListTags({
      environmentName: ctx.environment ?? "",
      tagPrefix: RETENTION_PREFIX,
      maxObjects: 100,
      pageToken: "",
    });
    let newest: { value: RetentionDays; at: number } | null = null;
    for (const item of page.items) {
      const match = /retention-(forever|\d+)d?\.(\d+)$/.exec(item.tag);
      if (!match) continue;
      const at = Number(match[2]);
      if (newest && at <= newest.at) continue;
      const days = match[1] === "forever" ? null : Number(match[1]);
      newest = { value: days as RetentionDays, at };
    }
    return newest ? newest.value : defaultRetentionDays;
  } catch {
    return defaultRetentionDays;
  }
}

export async function writeRetention(
  ctx: SnapshotContext,
  days: RetentionDays,
): Promise<void> {
  const marker = await tombstone(ctx);
  const value = days === null ? "forever" : `${days}d`;
  await marker.publish(`${RETENTION_PREFIX}${value}.${Date.now()}`, {
    environment: ctx.environment,
  });
}

/** Resolve a snapshot's tag to an image, ready to launch from. */
export async function imageForSnapshot(
  ctx: SnapshotContext,
  tag: string,
): Promise<Image> {
  const [name, version] = tag.split(":");
  return ctx.client.images.fromName(`${name}:${version}`, {
    environment: ctx.environment,
  });
}

export async function deleteSnapshot(
  ctx: SnapshotContext,
  snapshot: Snapshot,
): Promise<void> {
  // Point the tag at the marker first: if the delete fails afterwards the
  // snapshot is merely orphaned, whereas the reverse order could leave a tag
  // that still looks alive but resolves to nothing.
  const marker = await tombstone(ctx);
  await marker.publish(snapshot.tag, { environment: ctx.environment });
  await ctx.client.images.delete(snapshot.imageId).catch(() => {
    // already gone, or shared with a kept copy — the marker is what matters
  });
}

/** Every snapshot of a sandbox, deleted — used by Forget. */
export async function deleteAllSnapshots(
  ctx: SnapshotContext,
  sandbox: string,
): Promise<number> {
  const snapshots = await listSnapshots(ctx, sandbox);
  const results = await Promise.allSettled(
    snapshots.map((snapshot) => deleteSnapshot(ctx, snapshot)),
  );
  return results.filter((r) => r.status === "fulfilled").length;
}
