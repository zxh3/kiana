import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  CHAT_PATH,
  type ClientMessage,
  cleanName,
  parseServerMessage,
  quietTyping,
  randomName,
  typingSignal,
} from "../../../../lib/chat";
import { useStoredState } from "../../use-stored-state";
import { chatReducer, initialChatState, parseChatName } from "./chat";
import { useLiveSocket } from "./use-live-socket";

/**
 * The connection to the chat room, open only while `open` (the Chat Room's
 * screens are showing), so the Online list counts people who have it open.
 * It reconnects on its own if the connection drops, and tells the room
 * when the viewer is typing (`typingSignal` says how often). The name is
 * kept between visits; the first time, it is made up (user_ and four
 * digits).
 */
export function useChat(open: boolean) {
  const [name, setName] = useStoredState("kiana.chat-name", parseChatName);
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const typed = useRef(quietTyping);
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    if (open && !name) setName(randomName());
  }, [name, open, setName]);

  const post: (message: ClientMessage) => boolean = useLiveSocket({
    onMessage: (data) => {
      const message = parseServerMessage(data);
      if (message) dispatch({ type: "received", message, at: Date.now() });
    },
    onOpen: () => {
      typed.current = quietTyping;
      post({ type: "join", name: nameRef.current });
    },
    onStatus: (status) => dispatch({ type: status }),
    open: open && Boolean(name),
    path: CHAT_PATH,
  });

  // Sending what was typed is the end of typing it.
  const say = useCallback(
    (text: string) => {
      typed.current = quietTyping;
      return post({ type: "say", text });
    },
    [post],
  );

  /** The draft changed: tells the room when the viewer types, or stops. */
  const typing = useCallback(
    (hasText: boolean) => {
      const next = typingSignal(typed.current, hasText, Date.now());
      typed.current = next.signal;
      if (next.send !== null) post({ type: "typing", active: next.send });
    },
    [post],
  );

  return {
    ...state,
    name,
    say,
    typing,
    rename: (next: string) => {
      const clean = cleanName(next);
      if (!clean || clean === name) return;
      setName(clean);
      post({ type: "rename", name: clean });
    },
  };
}

export type Chat = ReturnType<typeof useChat>;
