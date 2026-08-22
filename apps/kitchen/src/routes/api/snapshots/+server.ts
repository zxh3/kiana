import { json } from "@sveltejs/kit";
import { credentialsFrom, modalErrorMessage } from "$lib/server/modal";
import {
  deleteAllSnapshots,
  deleteSnapshot,
  keepSnapshot,
  listSnapshots,
  snapshotContext,
  snapshotSummary,
} from "$lib/server/snapshots";
import type { RequestHandler } from "./$types";

/**
 * GET /api/snapshots?sandbox=<name> — that sandbox's live snapshots, newest
 * first. Without `sandbox`, the same across every sandbox, which the table uses
 * for its counts and for each sandbox's last-stopped time.
 *
 * Both return the raw list: deciding what a person should see (dropping what
 * this browser deleted, collapsing kept twins) happens client-side, in one
 * place, so a count can never disagree with the list it opens.
 */
export const GET: RequestHandler = async ({ request, url }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });
  const sandbox = url.searchParams.get("sandbox");

  const ctx = snapshotContext(creds);
  try {
    if (!sandbox) {
      return json({ summary: await snapshotSummary(ctx) });
    }
    return json({ snapshots: await listSnapshots(ctx, sandbox) });
  } catch (e) {
    return json({ error: modalErrorMessage(e) }, { status: 502 });
  } finally {
    ctx.client.close();
  }
};

/**
 * POST — keep an automatic snapshot so it stops expiring. A snapshot's TTL
 * cannot be changed, so this derives a TTL-free image from it and publishes
 * that under the same captured-state stamp.
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
    const snapshots = await listSnapshots(
      ctx,
      tag.split(":")[0].replace(/^kitchen-snap-/, ""),
    );
    const snapshot = snapshots.find((p) => p.tag === tag);
    if (!snapshot) {
      return json(
        { error: "That snapshot no longer exists." },
        { status: 404 },
      );
    }
    return json({ snapshot: await keepSnapshot(ctx, snapshot, label) });
  } catch (e) {
    return json({ error: modalErrorMessage(e) }, { status: 502 });
  } finally {
    ctx.client.close();
  }
};

/**
 * DELETE ?tag=<tag> for one snapshot, or ?sandbox=<name> for all of a sandbox's
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
      return json({ deleted: await deleteAllSnapshots(ctx, sandbox) });
    }
    if (!tag) {
      return json({ error: "Missing ?tag= or ?sandbox=." }, { status: 400 });
    }
    const name = tag.split(":")[0].replace(/^kitchen-snap-/, "");
    const snapshot = (await listSnapshots(ctx, name)).find(
      (p) => p.tag === tag,
    );
    if (snapshot) await deleteSnapshot(ctx, snapshot);
    return json({ deleted: snapshot ? 1 : 0 });
  } catch (e) {
    return json({ error: modalErrorMessage(e) }, { status: 502 });
  } finally {
    ctx.client.close();
  }
};
