import {
  type ChatMessage,
  cleanName,
  type Person,
  type ServerMessage,
  TYPING_SHOWS_FOR,
} from "../../../../../lib/chat";

/**
 * The Chat Room's side of the conversation, as a pure reducer: what the
 * connection is doing, who is here and who is typing, and the messages so
 * far: the latest page from joining, earlier pages added in front as the
 * viewer scrolls up for them, and every new one. `use-chat.ts` feeds it
 * the socket's events.
 */

export type ChatStatus = "connecting" | "open" | "offline";

export type ChatState = {
  status: ChatStatus;
  /** This browser's person id in the room, once it has joined. */
  you: string | null;
  people: Person[];
  messages: ChatMessage[];
  /** Whether the room has messages from before the first one here. */
  more: boolean;
  /** Earlier messages asked for and not here yet. */
  loadingOlder: boolean;
  /** A word from the room, such as asking to slow down. */
  notice: string | null;
  /** Who else is typing, and when this browser last heard so. */
  typists: Typist[];
};

export type Typist = { id: string; name: string; at: number };

export type ChatEvent =
  | { type: "connecting" }
  | { type: "offline" }
  /** Asked the room for the page before the first message here. */
  | { type: "loadingOlder" }
  /** `at` is when it arrived, by this browser's clock. */
  | { type: "received"; message: ServerMessage; at: number };

export const initialChatState: ChatState = {
  status: "connecting",
  you: null,
  people: [],
  messages: [],
  more: false,
  loadingOlder: false,
  notice: null,
  typists: [],
};

export function chatReducer(state: ChatState, event: ChatEvent): ChatState {
  if (event.type === "connecting") return { ...state, status: "connecting" };
  // Who was here is no longer known; the messages stay to read.
  if (event.type === "offline") {
    return {
      ...state,
      status: "offline",
      you: null,
      people: [],
      typists: [],
      loadingOlder: false,
    };
  }
  if (event.type === "loadingOlder") return { ...state, loadingOlder: true };
  const message = event.message;
  switch (message.type) {
    case "welcome":
      return {
        status: "open",
        you: message.you,
        people: message.people,
        messages: message.messages,
        more: message.more,
        loadingOlder: false,
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
        messages: [...state.messages, message.message],
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
    // Earlier messages go in front, leaving out any already here.
    case "history": {
      const here = new Set(state.messages.map((each) => each.id));
      const earlier = message.messages.filter((each) => !here.has(each.id));
      return {
        ...state,
        messages: [...earlier, ...state.messages],
        more: message.more,
        loadingOlder: false,
      };
    }
    case "notice":
      return { ...state, notice: message.text };
  }
}

/**
 * The message to ask for the page before, when the viewer has scrolled up
 * to the top: the first one here, if the room has earlier ones and none
 * are on their way already; otherwise null.
 */
export function olderPageBefore(state: ChatState) {
  if (state.status !== "open" || !state.more || state.loadingOlder) return null;
  return state.messages[0]?.id ?? null;
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
