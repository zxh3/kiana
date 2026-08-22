import { json } from "@sveltejs/kit";
import {
  credentialsFrom,
  launchSandbox,
  listSandboxes,
  modalErrorMessage,
} from "$lib/server/modal";
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

export const POST: RequestHandler = async ({ request }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });
  const result = validateSpec(await request.json().catch(() => ({})));
  if (!result.ok) return json({ error: result.error }, { status: 400 });
  try {
    const { sandboxId } = await launchSandbox(creds, result.spec);
    return json({ sandboxId }, { status: 201 });
  } catch (e) {
    return json({ error: modalErrorMessage(e) }, { status: 502 });
  }
};
