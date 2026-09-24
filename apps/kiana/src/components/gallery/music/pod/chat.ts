import {
  type ChatMessage,
  cleanName,
  HISTORY_SIZE,
  type Person,
  type ServerMessage,
  TYPING_SHOWS_FOR,
} from "../../../../lib/chat";

/**
 * The Chat Room's side of the conversation, as a pure reducer: what the
 * connection is doing, who is here and who is typing, and the messages so
 * far. `use-chat.ts`
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
  /** Who else is typing, and when this browser last heard so. */
  typists: Typist[];
};

export type Typist = { id: string; name: string; at: number };

export type ChatEvent =
  | { type: "connecting" }
  | { type: "offline" }
  /** `at` is when it arrived, by this browser's clock. */
  | { type: "received"; message: ServerMessage; at: number };

export const initialChatState: ChatState = {
  status: "connecting",
  you: null,
  people: [],
  messages: [],
  notice: null,
  typists: [],
};

export function chatReducer(state: ChatState, event: ChatEvent): ChatState {
  if (event.type === "connecting") return { ...state, status: "connecting" };
  // Who was here is no longer known; the messages stay to read.
  if (event.type === "offline") {
    return { ...state, status: "offline", you: null, people: [], typists: [] };
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
        typists: [],
      };
    // Someone who left is no longer typing.
    case "people": {
      const here = new Set(message.people.map((person) => person.id));
      return {
        ...state,
        people: message.people,
        typists: state.typists.filter((typist) => here.has(typist.id)),
      };
    }
    // Their message is what they were typing.
    case "message":
      return {
        ...state,
        messages: [...state.messages, message.message].slice(-HISTORY_SIZE),
        notice: null,
        typists: state.typists.filter(
          (typist) => typist.id !== message.message.from,
        ),
      };
    case "typing": {
      const others = state.typists.filter((typist) => typist.id !== message.id);
      if (!message.active || message.id === state.you) {
        return { ...state, typists: others };
      }
      // Whoever is already typing keeps their place in the line.
      const typist = { id: message.id, name: message.name, at: event.at };
      const known = others.length < state.typists.length;
      return {
        ...state,
        typists: known
          ? state.typists.map((each) => (each.id === typist.id ? typist : each))
          : [...state.typists, typist],
      };
    }
    case "notice":
      return { ...state, notice: message.text };
  }
}

/** Who is typing at `now`: those heard from recently enough. */
export function typingNow(state: Pick<ChatState, "typists">, now: number) {
  return state.typists.filter((typist) => now - typist.at < TYPING_SHOWS_FOR);
}

/** When the next typist drops out of `typingNow`, if anyone is typing. */
export function typingChangesAt(
  state: Pick<ChatState, "typists">,
  now: number,
) {
  const current = typingNow(state, now);
  if (current.length === 0) return null;
  return Math.min(...current.map((typist) => typist.at + TYPING_SHOWS_FOR));
}

/**
 * The line under the messages: one or two names, or how many, with the
 * longest first to start typing named first.
 */
export function typingLine(typists: ReadonlyArray<Typist>) {
  if (typists.length === 0) return "";
  if (typists.length === 1) return `${typists[0].name} is typing`;
  if (typists.length === 2) {
    return `${typists[0].name} and ${typists[1].name} are typing`;
  }
  return `${typists.length} people are typing`;
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
