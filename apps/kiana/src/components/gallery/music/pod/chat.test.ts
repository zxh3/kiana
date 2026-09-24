import { describe, expect, it } from "vitest";

import {
  HISTORY_SIZE,
  type ServerMessage,
  TYPING_SHOWS_FOR,
} from "../../../../lib/chat";
import {
  type ChatEvent,
  chatReducer,
  initialChatState,
  otherPeople,
  parseChatName,
  retryDelay,
  typingChangesAt,
  typingLine,
  typingNow,
} from "./chat";

const received = (message: ServerMessage, at = 0): ChatEvent => ({
  type: "received",
  message,
  at,
});

const said = (id: string, from = "p1") => ({
  id,
  from,
  name: "kiana",
  text: `message ${id}`,
  at: 1,
});

const welcomed = chatReducer(initialChatState, {
  type: "received",
  at: 0,
  message: {
    type: "welcome",
    you: "p1",
    people: [
      { id: "p1", name: "kiana" },
      { id: "p3", name: "zed" },
      { id: "p2", name: "amy" },
    ],
    messages: [said("a")],
  },
});

describe("chatReducer", () => {
  it("opens with the room's people and history", () => {
    expect(welcomed.status).toBe("open");
    expect(welcomed.you).toBe("p1");
    expect(welcomed.messages).toEqual([said("a")]);
  });

  it("adds messages, keeping only the last ones", () => {
    let state = welcomed;
    for (let index = 0; index < HISTORY_SIZE + 5; index += 1) {
      state = chatReducer(
        state,
        received({ type: "message", message: said(String(index)) }),
      );
    }
    expect(state.messages).toHaveLength(HISTORY_SIZE);
    expect(state.messages.at(-1)?.id).toBe(String(HISTORY_SIZE + 4));
  });

  it("shows a notice until the next message", () => {
    const noticed = chatReducer(
      welcomed,
      received({ type: "notice", text: "Slow down a little." }),
    );
    expect(noticed.notice).toBe("Slow down a little.");
    const next = chatReducer(
      noticed,
      received({ type: "message", message: said("b") }),
    );
    expect(next.notice).toBeNull();
  });

  it("forgets who is here when the connection drops, not the messages", () => {
    const offline = chatReducer(welcomed, { type: "offline" });
    expect(offline).toMatchObject({ status: "offline", you: null, people: [] });
    expect(offline.messages).toEqual(welcomed.messages);
  });
});

describe("who is typing", () => {
  const typing = (id: string, name: string, at: number, active = true) =>
    received({ type: "typing", id, name, active }, at);
  const amy = chatReducer(welcomed, typing("p2", "amy", 1_000));

  it("shows someone typing for a while after they last said so", () => {
    expect(typingNow(amy, 1_000).map((typist) => typist.name)).toEqual(["amy"]);
    expect(typingNow(amy, 1_000 + TYPING_SHOWS_FOR)).toEqual([]);
    expect(typingChangesAt(amy, 1_500)).toBe(1_000 + TYPING_SHOWS_FOR);
    expect(typingChangesAt(amy, 1_000 + TYPING_SHOWS_FOR)).toBeNull();
  });

  it("keeps the first typist first as others join and go on", () => {
    const both = chatReducer(amy, typing("p3", "zed", 1_200));
    const again = chatReducer(both, typing("p2", "amy", 3_000));
    expect(again.typists.map((typist) => [typist.name, typist.at])).toEqual([
      ["amy", 3_000],
      ["zed", 1_200],
    ]);
  });

  it("stops when they clear the draft, send, or leave", () => {
    expect(chatReducer(amy, typing("p2", "amy", 1_100, false)).typists).toEqual(
      [],
    );
    const sent = chatReducer(
      amy,
      received({ type: "message", message: said("c", "p2") }),
    );
    expect(sent.typists).toEqual([]);
    const left = chatReducer(
      amy,
      received({ type: "people", people: [{ id: "p1", name: "kiana" }] }),
    );
    expect(left.typists).toEqual([]);
    expect(chatReducer(amy, { type: "offline" }).typists).toEqual([]);
  });

  it("never shows this browser as typing", () => {
    expect(chatReducer(welcomed, typing("p1", "kiana", 1_000)).typists).toEqual(
      [],
    );
  });

  it("says who in a short line", () => {
    const typist = (name: string) => ({ id: name, name, at: 0 });
    expect(typingLine([])).toBe("");
    expect(typingLine([typist("amy")])).toBe("amy is typing");
    expect(typingLine([typist("amy"), typist("zed")])).toBe(
      "amy and zed are typing",
    );
    expect(typingLine(["a", "b", "c"].map(typist))).toBe("3 people are typing");
  });
});

describe("otherPeople", () => {
  it("leaves this browser out and sorts the rest by name", () => {
    expect(otherPeople(welcomed).map((person) => person.name)).toEqual([
      "amy",
      "zed",
    ]);
  });
});

describe("parseChatName", () => {
  it("keeps a clean name and drops junk", () => {
    expect(parseChatName(" kiana ")).toBe("kiana");
    expect(parseChatName(null)).toBe("");
    expect(parseChatName("   ")).toBe("");
  });
});

describe("retryDelay", () => {
  it("doubles up to half a minute", () => {
    expect([0, 1, 2, 10].map(retryDelay)).toEqual([
      1_000, 2_000, 4_000, 30_000,
    ]);
  });
});
