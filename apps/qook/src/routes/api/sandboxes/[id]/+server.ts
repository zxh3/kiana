import { json } from "@sveltejs/kit";
import {
  credentialsFrom,
  getSession,
  modalErrorMessage,
  terminateSandbox,
} from "$lib/server/modal";
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

export const DELETE: RequestHandler = async ({ request, params }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });
  try {
    await terminateSandbox(creds, params.id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: modalErrorMessage(e) }, { status: 502 });
  }
};
