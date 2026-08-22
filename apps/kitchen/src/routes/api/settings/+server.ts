import { json } from "@sveltejs/kit";
import { credentialsFrom, modalErrorMessage } from "$lib/server/modal";
import {
  readRetention,
  snapshotContext,
  writeRetention,
} from "$lib/server/snapshots";
import { retentionFrom } from "$lib/server/validate";
import type { RequestHandler } from "./$types";

/**
 * Workspace settings, kept where every browser can see them rather than in one
 * browser's localStorage. Today that is the retention for new automatic
 * snapshots — a policy two people should not be able to disagree about.
 */
export const GET: RequestHandler = async ({ request }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });
  const ctx = snapshotContext(creds);
  try {
    return json({ retentionDays: await readRetention(ctx) });
  } catch (e) {
    return json({ error: modalErrorMessage(e) }, { status: 502 });
  } finally {
    ctx.client.close();
  }
};

export const PUT: RequestHandler = async ({ request }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const retentionDays = retentionFrom(
    body?.retentionDays === null ? "forever" : String(body?.retentionDays),
  );
  const ctx = snapshotContext(creds);
  try {
    await writeRetention(ctx, retentionDays);
    return json({ retentionDays });
  } catch (e) {
    return json({ error: modalErrorMessage(e) }, { status: 502 });
  } finally {
    ctx.client.close();
  }
};
