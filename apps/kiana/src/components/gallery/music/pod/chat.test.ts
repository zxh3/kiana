import { describe, expect, it } from "vitest";

import { HISTORY_SIZE } from "../../../../lib/chat";
import {
  chatReducer,
  initialChatState,
  otherPeople,
  parseChatName,
  retryDelay,
} from "./chat";

const said = (id: string) => ({
  id,
  from: "p1",
  name: "kiana",
  text: `message ${id}`,
  at: 1,
});

const welcomed = chatReducer(initialChatState, {
  type: "received",
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
      state = chatReducer(state, {
        type: "received",
        message: { type: "message", message: said(String(index)) },
      });
    }
    expect(state.messages).toHaveLength(HISTORY_SIZE);
    expect(state.messages.at(-1)?.id).toBe(String(HISTORY_SIZE + 4));
  });

  it("shows a notice until the next message", () => {
    const noticed = chatReducer(welcomed, {
      type: "received",
      message: { type: "notice", text: "Slow down a little." },
    });
    expect(noticed.notice).toBe("Slow down a little.");
    const next = chatReducer(noticed, {
      type: "received",
      message: { type: "message", message: said("b") },
    });
    expect(next.notice).toBeNull();
  });

  it("forgets who is here when the connection drops, not the messages", () => {
    const offline = chatReducer(welcomed, { type: "offline" });
    expect(offline).toMatchObject({ status: "offline", you: null, people: [] });
    expect(offline.messages).toEqual(welcomed.messages);
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
