import { json } from "@sveltejs/kit";
import {
  credentialsFrom,
  hasServerCredentials,
  verifyToken,
} from "$lib/server/modal";
import type { RequestHandler } from "./$types";

/** Verify whichever credentials this request resolves to (headers, else server env). */
export const GET: RequestHandler = async ({ request }) => {
  const creds = credentialsFrom(request);
  if (!creds) {
    return json(
      { error: "No Modal credentials.", serverCredentials: false },
      { status: 401 },
    );
  }
  const result = await verifyToken(creds);
  if (!result.ok) return json({ error: result.error }, { status: 401 });
  return json({
    workspace: result.workspace,
    environment: creds.environment ?? null,
    source: request.headers.get("x-modal-token-id") ? "browser" : "server",
    serverCredentials: hasServerCredentials(),
  });
};
