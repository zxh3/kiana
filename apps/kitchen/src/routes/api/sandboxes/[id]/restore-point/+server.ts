import { json } from "@sveltejs/kit";
import {
  credentialsFrom,
  modalErrorMessage,
  saveRunningSandbox,
} from "$lib/server/modal";
import { ndjsonStream } from "$lib/server/stream";
import { retentionFrom } from "$lib/server/validate";
import type { RequestHandler } from "./$types";

/**
 * Save a restore point of a *running* sandbox, without stopping it.
 *
 * This is the mid-session save: the whole reason it exists is that a sandbox
 * killed unattended (a crash, or the 24h lifetime) only keeps what its last
 * point holds. Streamed, because the snapshot itself takes seconds.
 */
export const POST: RequestHandler = async ({ request, params, url }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });

  const label = url.searchParams.get("label") ?? undefined;
  return ndjsonStream(
    "snapshotting",
    async ({ phase }) => {
      const point = await saveRunningSandbox(
        creds,
        params.id,
        {
          retentionDays: retentionFrom(url.searchParams.get("retentionDays")),
          label,
        },
        phase,
      );
      return { point };
    },
    modalErrorMessage,
  );
};
