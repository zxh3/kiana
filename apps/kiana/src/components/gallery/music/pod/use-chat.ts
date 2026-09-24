import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  CHAT_PATH,
  type ClientMessage,
  cleanName,
  PING,
  PONG,
  parseServerMessage,
  randomName,
} from "../../../../lib/chat";
import { useStoredState } from "../../use-stored-state";
import {
  chatReducer,
  initialChatState,
  parseChatName,
  retryDelay,
} from "./chat";

/** How often a quiet connection pings the room, so nothing between drops it. */
const PING_EVERY = 25_000;

/**
 * The connection to the chat room, open only while `open` (the Chat Room's
 * screens are showing), so the Online list counts people who have it open.
 * It reconnects on its own if the connection drops. The name is kept
 * between visits; the first time, it is made up (user_ and four digits).
 */
export function useChat(open: boolean) {
  const [name, setName] = useStoredState("kiana.chat-name", parseChatName);
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const socket = useRef<WebSocket | null>(null);
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    if (open && !name) setName(randomName());
  }, [name, open, setName]);

  const named = Boolean(name);
  useEffect(() => {
    if (!open || !named) return;
    let attempt = 0;
    let retry: number | undefined;
    let ping: number | undefined;
    let current: WebSocket | null = null;

    const connect = () => {
      dispatch({ type: "connecting" });
      const url = new URL(CHAT_PATH, window.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(url);
      current = ws;
      ws.addEventListener("open", () => {
        attempt = 0;
        socket.current = ws;
        const join: ClientMessage = { type: "join", name: nameRef.current };
        ws.send(JSON.stringify(join));
        ping = window.setInterval(() => ws.send(PING), PING_EVERY);
      });
      ws.addEventListener("message", (event) => {
        if (event.data === PONG) return;
        const message = parseServerMessage(event.data);
        if (message) dispatch({ type: "received", message });
      });
      ws.addEventListener("close", () => {
        window.clearInterval(ping);
        if (current !== ws) return;
        socket.current = null;
        dispatch({ type: "offline" });
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
      dispatch({ type: "offline" });
    };
  }, [named, open]);

  const post = useCallback((message: ClientMessage) => {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(message));
    return true;
  }, []);

  return {
    ...state,
    name,
    say: (text: string) => post({ type: "say", text }),
    rename: (next: string) => {
      const clean = cleanName(next);
      if (!clean || clean === name) return;
      setName(clean);
      post({ type: "rename", name: clean });
    },
  };
}

export type Chat = ReturnType<typeof useChat>;
