/**
 * NDJSON progress streams for the operations that take real time.
 *
 * Starting a sandbox can run minutes (a first-time image build) and stopping
 * one takes as long as its snapshot, so both answer with a stream of
 * `OpEvent`s rather than one long silence. Status is 200 even for failures:
 * by the time such an operation can fail the headers are long gone, so the
 * verdict has to live in the body.
 */

import type { OpEvent, OpPhase } from "$lib/types";

/** Repeat the current phase this often, so proxies don't drop an idle stream. */
const HEARTBEAT_MS = 10_000;

export interface OpStream {
  /** Report progress; also becomes the heartbeat's payload. */
  phase: (phase: OpPhase) => void;
  send: (event: OpEvent) => void;
}

/**
 * Run `work` while streaming its progress. `work` reports phases and returns
 * the terminal event; thrown errors are turned into `{ error }` by `onError`.
 */
export function ndjsonStream(
  initialPhase: OpPhase,
  work: (stream: OpStream) => Promise<OpEvent>,
  onError: (e: unknown) => string,
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let current = initialPhase;
      const send = (event: OpEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // the client hung up; the operation itself carries on
        }
      };
      const heartbeat = setInterval(
        () => send({ phase: current }),
        HEARTBEAT_MS,
      );
      try {
        send({ phase: current });
        const result = await work({
          phase: (phase) => {
            current = phase;
            send({ phase });
          },
          send,
        });
        send(result);
      } catch (e) {
        send({ error: onError(e) });
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

  return new Response(body, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
      // tell any intermediary not to buffer the phases into one blob
      "x-accel-buffering": "no",
    },
  });
}
