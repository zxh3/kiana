import { useCallback, useEffect, useRef } from "react";

import { PING, PONG } from "../../../../lib/chat";
import { retryDelay } from "./live-socket";

/** How often a quiet connection pings, so nothing between drops it. */
const PING_EVERY = 25_000;

/**
 * A WebSocket to one of the pod's live apps on this site (`path`), open
 * only while `open`. It reconnects on its own when the connection drops,
 * waiting longer each time, and pings while quiet; the Durable Object
 * answers the pings without waking. The handlers are the latest ones
 * passed, so they may change from render to render.
 */
export function useLiveSocket({
  account,
  onMessage,
  onOpen,
  onStatus,
  open,
  path,
}: {
  /**
   * The account the viewer signed in with, if any. The Worker reads it
   * from the session cookie as the socket opens, so signing in or out
   * connects again, as them.
   */
  account: string | null;
  onMessage: (data: string) => void;
  /** Connected, or connected again: the moment to say hello. */
  onOpen: () => void;
  onStatus: (status: "connecting" | "offline") => void;
  open: boolean;
  path: string;
}) {
  const socket = useRef<WebSocket | null>(null);
  const handlers = useRef({ onMessage, onOpen, onStatus });
  handlers.current = { onMessage, onOpen, onStatus };

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new account connects again, as them
  useEffect(() => {
    if (!open) return;
    let attempt = 0;
    let retry: number | undefined;
    let ping: number | undefined;
    let current: WebSocket | null = null;

    const connect = () => {
      handlers.current.onStatus("connecting");
      const url = new URL(path, window.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(url);
      current = ws;
      ws.addEventListener("open", () => {
        attempt = 0;
        socket.current = ws;
        handlers.current.onOpen();
        ping = window.setInterval(() => ws.send(PING), PING_EVERY);
      });
      ws.addEventListener("message", (event) => {
        if (typeof event.data !== "string" || event.data === PONG) return;
        handlers.current.onMessage(event.data);
      });
      ws.addEventListener("close", () => {
        window.clearInterval(ping);
        if (current !== ws) return;
        socket.current = null;
        handlers.current.onStatus("offline");
        retry = window.setTimeout(connect, retryDelay(attempt));
        attempt += 1;
      });
    };
    connect();

    return () => {
      window.clearTimeout(retry);
      window.clearInterval(ping);
      const closing = current;
      current = null;
      socket.current = null;
      closing?.close();
      handlers.current.onStatus("offline");
    };
  }, [account, open, path]);

  /** Sends a message as JSON, if connected; says whether it went. */
  return useCallback((message: unknown) => {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(message));
    return true;
  }, []);
}
