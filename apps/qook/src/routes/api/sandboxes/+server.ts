import { json } from "@sveltejs/kit";
import {
  credentialsFrom,
  launchSandbox,
  listSandboxes,
  modalErrorMessage,
} from "$lib/server/modal";
import { validateSpec } from "$lib/server/validate";
import type { LaunchEvent, LaunchPhase } from "$lib/types";
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
 * Creating a sandbox takes anywhere from seconds to a couple of minutes (the
 * first launch of a base image builds the runtime), so the response is an
 * NDJSON stream of `LaunchEvent`s rather than one long silence: phases as they
 * happen, then either the sandbox id or an error. Status is 200 even for
 * failures — by the time a launch fails the headers are long gone, so the
 * outcome has to live in the body. A dropped stream is recoverable: the client
 * falls back to polling the list for the name.
 */
export const POST: RequestHandler = async ({ request }) => {
  const creds = credentialsFrom(request);
  if (!creds) return json({ error: "No Modal credentials." }, { status: 401 });
  const result = validateSpec(await request.json().catch(() => ({})));
  if (!result.ok) return json({ error: result.error }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: LaunchEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // client hung up mid-launch; the launch itself continues
        }
      };
      // Repeat the current phase every 10s: proxies drop idle connections,
      // and a phase can legitimately last minutes.
      let phase: LaunchPhase = "image";
      const heartbeat = setInterval(() => send({ phase }), 10_000);
      try {
        const { sandboxId } = await launchSandbox(
          creds,
          result.spec,
          (next) => {
            phase = next;
            send({ phase: next });
          },
        );
        send({ sandboxId });
      } catch (e) {
        send({ error: modalErrorMessage(e) });
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
      // tell any intermediary not to buffer the phases into one blob
      "x-accel-buffering": "no",
    },
  });
};
