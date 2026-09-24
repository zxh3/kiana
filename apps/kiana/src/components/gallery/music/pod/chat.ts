import {
  type ChatMessage,
  cleanName,
  HISTORY_SIZE,
  type Person,
  type ServerMessage,
} from "../../../../lib/chat";

/**
 * The Chat Room's side of the conversation, as a pure reducer: what the
 * connection is doing, who is here, and the messages so far. `use-chat.ts`
 * feeds it the socket's events.
 */

export type ChatStatus = "connecting" | "open" | "offline";

export type ChatState = {
  status: ChatStatus;
  /** This browser's person id in the room, once it has joined. */
  you: string | null;
  people: Person[];
  messages: ChatMessage[];
  /** A word from the room, such as asking to slow down. */
  notice: string | null;
};

export type ChatEvent =
  | { type: "connecting" }
  | { type: "offline" }
  | { type: "received"; message: ServerMessage };

export const initialChatState: ChatState = {
  status: "connecting",
  you: null,
  people: [],
  messages: [],
  notice: null,
};

export function chatReducer(state: ChatState, event: ChatEvent): ChatState {
  if (event.type === "connecting") return { ...state, status: "connecting" };
  // Who was here is no longer known; the messages stay to read.
  if (event.type === "offline") {
    return { ...state, status: "offline", you: null, people: [] };
  }
  const message = event.message;
  switch (message.type) {
    case "welcome":
      return {
        status: "open",
        you: message.you,
        people: message.people,
        messages: message.messages.slice(-HISTORY_SIZE),
        notice: null,
      };
    case "people":
      return { ...state, people: message.people };
    case "message":
      return {
        ...state,
        messages: [...state.messages, message.message].slice(-HISTORY_SIZE),
        notice: null,
      };
    case "notice":
      return { ...state, notice: message.text };
  }
}

/** Everyone else here, by name, for the Online list under this browser. */
export function otherPeople(state: ChatState) {
  return state.people
    .filter((person) => person.id !== state.you)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The stored name, or "" until one is picked or made up. */
export function parseChatName(raw: string | null) {
  return cleanName(raw);
}

/** How long to wait before reconnecting, doubling to half a minute. */
export function retryDelay(attempt: number) {
  return Math.min(30_000, 1_000 * 2 ** attempt);
}
