import { json } from "@sveltejs/kit";
import {
  credentialsFrom,
  launchSandbox,
  listSandboxes,
  modalErrorMessage,
} from "$lib/server/modal";
import { ndjsonStream } from "$lib/server/stream";
import { validateSpec } from "$lib/server/validate";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });
  try {
    return json({ sandboxes: await listSandboxes(creds) });
  } catch (e) {
    return json({ error: modalErrorMessage(e) }, { status: 502 });
  }
};

/**
 * Start a sandbox — new, resumed, or forked. All three are the same operation:
 * create from an image, where the image is either freshly built or a
 * snapshot. `fromSnapshot` names one explicitly; without it an existing sandbox
 * resumes its newest. A fork is simply `fromSnapshot` under a new name.
 *
 * Answers with an NDJSON progress stream; see server/stream.ts.
 */
export const POST: RequestHandler = async ({ request }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const result = validateSpec(body);
  if (!result.ok) return json({ error: result.error }, { status: 400 });

  const fromSnapshot =
    typeof body?.fromSnapshot === "string" ? body.fromSnapshot : undefined;
  const forkedFrom =
    typeof body?.forkedFrom === "string" ? body.forkedFrom : undefined;
  const fresh = body?.fresh === true;

  return ndjsonStream(
    "resolving",
    async ({ phase }) => {
      const { sandboxId } = await launchSandbox(creds, result.spec, phase, {
        fromSnapshot,
        forkedFrom,
        fresh,
      });
      return { sandboxId };
    },
    modalErrorMessage,
  );
};
