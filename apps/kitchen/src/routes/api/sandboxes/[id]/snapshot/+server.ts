import { json } from "@sveltejs/kit";
import {
  credentialsFrom,
  modalErrorMessage,
  saveRunningSandbox,
} from "$lib/server/modal";
import { ndjsonStream } from "$lib/server/stream";
import type { RequestHandler } from "./$types";

/**
 * Save a snapshot of a *running* sandbox, without stopping it.
 *
 * This is the mid-session save: the whole reason it exists is that a sandbox
 * killed unattended (a crash, or the 24h lifetime) only keeps what its last
 * snapshot holds. Streamed, because the snapshot itself takes seconds.
 */
export const POST: RequestHandler = async ({ request, params, url }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });

  const label = url.searchParams.get("label") ?? undefined;
  return ndjsonStream(
    "snapshotting",
    async ({ phase }) => {
      const snapshot = await saveRunningSandbox(
        creds,
        params.id,
        { label },
        phase,
      );
      return { snapshot };
    },
    modalErrorMessage,
  );
};
