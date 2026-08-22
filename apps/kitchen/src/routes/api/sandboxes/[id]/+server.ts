import { json } from "@sveltejs/kit";
import {
  credentialsFrom,
  getSession,
  modalErrorMessage,
  stopSandbox,
} from "$lib/server/modal";
import { ndjsonStream } from "$lib/server/stream";
import { retentionFrom } from "$lib/server/validate";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, params }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });
  try {
    const session = await getSession(creds, params.id);
    if (!session) {
      return json(
        { error: "This sandbox is no longer running." },
        { status: 404 },
      );
    }
    return json(session);
  } catch (e) {
    return json({ error: modalErrorMessage(e) }, { status: 502 });
  }
};

/**
 * Stop a sandbox, saving a snapshot on the way out. `?save=0` discards
 * the machine state instead — the escape hatch for a sandbox someone has
 * broken and would rather not carry forward. A label makes the snapshot
 * permanent.
 *
 * Streams progress: the snapshot is the slow part (seconds to tens of
 * seconds), and it happens while the sandbox is still alive.
 */
export const DELETE: RequestHandler = async ({ request, params, url }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });

  const save = url.searchParams.get("save") !== "0";
  const label = url.searchParams.get("label") ?? undefined;

  return ndjsonStream(
    save ? "snapshotting" : "stopping",
    async ({ phase }) => {
      await stopSandbox(
        creds,
        params.id,
        {
          save,
          retentionDays: retentionFrom(url.searchParams.get("retentionDays")),
          label,
        },
        phase,
      );
      return { done: true };
    },
    modalErrorMessage,
  );
};
