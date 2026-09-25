import { describe, expect, it } from "vitest";

import { type ServerMessage, TYPING_SHOWS_FOR } from "../../../../../lib/chat";
import {
  type ChatEvent,
  chatReducer,
  initialChatState,
  olderPageBefore,
  otherPeople,
  parseChatName,
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

const welcome: ChatEvent = {
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
    more: true,
  },
};
const welcomed = chatReducer(initialChatState, welcome);

describe("chatReducer", () => {
  it("opens with the room's people and history", () => {
    expect(welcomed.status).toBe("open");
    expect(welcomed.you).toBe("p1");
    expect(welcomed.messages).toEqual([said("a")]);
  });

  it("keeps every message it hears, newest last", () => {
    let state = welcomed;
    for (let index = 0; index < 150; index += 1) {
      state = chatReducer(
        state,
        received({ type: "message", message: said(String(index)) }),
      );
    }
    expect(state.messages).toHaveLength(151);
    expect(state.messages.at(-1)?.id).toBe("149");
  });

  it("asks for the page before the first message, once at a time", () => {
    expect(olderPageBefore(welcomed)).toBe("a");
    const asked = chatReducer(welcomed, { type: "loadingOlder" });
    expect(olderPageBefore(asked)).toBeNull();
    expect(olderPageBefore({ ...welcomed, more: false })).toBeNull();
    expect(olderPageBefore({ ...welcomed, status: "offline" })).toBeNull();
  });

  it("puts earlier pages in front, once each, until there are no more", () => {
    expect(welcomed.more).toBe(true);
    const asked = chatReducer(welcomed, { type: "loadingOlder" });
    expect(asked.loadingOlder).toBe(true);
    const paged = chatReducer(
      asked,
      received({
        type: "history",
        messages: [said("y"), said("z"), said("a")],
        more: false,
      }),
    );
    expect(paged.messages.map((each) => each.id)).toEqual(["y", "z", "a"]);
    expect(paged.more).toBe(false);
    expect(paged.loadingOlder).toBe(false);
    // A dropped connection stops waiting; joining again starts afresh.
    expect(chatReducer(asked, { type: "offline" }).loadingOlder).toBe(false);
    expect(chatReducer(paged, welcome).messages).toEqual([said("a")]);
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
