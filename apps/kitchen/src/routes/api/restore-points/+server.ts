import { json } from "@sveltejs/kit";
import { credentialsFrom, modalErrorMessage } from "$lib/server/modal";
import {
  deleteAllRestorePoints,
  deleteRestorePoint,
  keepRestorePoint,
  listRestorePoints,
  snapshotContext,
} from "$lib/server/snapshots";
import type { RequestHandler } from "./$types";

/** GET /api/restore-points?sandbox=<name> — newest first, expired filtered out. */
export const GET: RequestHandler = async ({ request, url }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });
  const sandbox = url.searchParams.get("sandbox");
  if (!sandbox) return json({ error: "Missing ?sandbox=." }, { status: 400 });

  const ctx = snapshotContext(creds);
  try {
    return json({ points: await listRestorePoints(ctx, sandbox) });
  } catch (e) {
    return json({ error: modalErrorMessage(e) }, { status: 502 });
  } finally {
    ctx.client.close();
  }
};

/**
 * POST — pin an automatic point so it stops expiring. A snapshot's TTL cannot
 * be changed, so this derives a TTL-free image from it and publishes that.
 */
export const POST: RequestHandler = async ({ request }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const tag = String(body?.tag ?? "");
  const label = String(body?.label ?? "");
  if (!tag) return json({ error: "Missing tag." }, { status: 400 });

  const ctx = snapshotContext(creds);
  try {
    const points = await listRestorePoints(
      ctx,
      tag.split(":")[0].replace(/^kitchen-snap-/, ""),
    );
    const point = points.find((p) => p.tag === tag);
    if (!point) {
      return json(
        { error: "That restore point no longer exists." },
        { status: 404 },
      );
    }
    return json({ point: await keepRestorePoint(ctx, point, label) });
  } catch (e) {
    return json({ error: modalErrorMessage(e) }, { status: 502 });
  } finally {
    ctx.client.close();
  }
};

/**
 * DELETE ?tag=<tag> for one point, or ?sandbox=<name> for all of a sandbox's
 * (used by Forget). Modal has no unpublish, so the tag string survives; the
 * client remembers what it deleted to keep its list clean.
 */
export const DELETE: RequestHandler = async ({ request, url }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });
  const tag = url.searchParams.get("tag");
  const sandbox = url.searchParams.get("sandbox");

  const ctx = snapshotContext(creds);
  try {
    if (sandbox) {
      return json({ deleted: await deleteAllRestorePoints(ctx, sandbox) });
    }
    if (!tag) {
      return json({ error: "Missing ?tag= or ?sandbox=." }, { status: 400 });
    }
    const name = tag.split(":")[0].replace(/^kitchen-snap-/, "");
    const point = (await listRestorePoints(ctx, name)).find(
      (p) => p.tag === tag,
    );
    if (point) await deleteRestorePoint(ctx, point);
    return json({ deleted: point ? 1 : 0 });
  } catch (e) {
    return json({ error: modalErrorMessage(e) }, { status: 502 });
  } finally {
    ctx.client.close();
  }
};
