import { describe, expect, it } from "vitest";

import {
  allowSend,
  allowTyping,
  cleanName,
  cleanText,
  expiryCutoff,
  MESSAGE_LIFETIME,
  NAME_MAX,
  nameFor,
  nextExpiry,
  parseClientMessage,
  parseServerMessage,
  quietTyping,
  randomName,
  SEND_LIMIT,
  SEND_WINDOW,
  TEXT_MAX,
  TYPING_EVERY,
  TYPING_MIN_GAP,
  typingSignal,
} from "./chat";

describe("nameFor", () => {
  it("prefers the account's name, cleaned, over the picked one", () => {
    expect(nameFor({ name: " Xiao  Hua " }, "user_1234")).toBe("Xiao Hua");
    expect(nameFor({ name: "" }, "user_1234")).toBe("user_1234");
    expect(nameFor(null, "user_1234")).toBe("user_1234");
  });
});

describe("cleanName", () => {
  it("trims and collapses spaces", () => {
    expect(cleanName("  kiana   the  cat ")).toBe("kiana the cat");
  });

  it("drops control and reordering characters", () => {
    expect(cleanName("ki\u0000an‮a\n")).toBe("ki an a");
  });

  it("cuts long names by character, not code unit", () => {
    const long = "🐱".repeat(NAME_MAX + 4);
    expect(Array.from(cleanName(long))).toHaveLength(NAME_MAX);
  });

  it("gives nothing for blanks and junk", () => {
    expect(cleanName("   ")).toBe("");
    expect(cleanName(42)).toBe("");
    expect(cleanName(null)).toBe("");
  });
});

describe("cleanText", () => {
  it("keeps a message to one line of at most the limit", () => {
    expect(cleanText("hi\nthere")).toBe("hi there");
    expect(cleanText("a".repeat(TEXT_MAX + 50))).toHaveLength(TEXT_MAX);
  });
});

describe("randomName", () => {
  it("is user_ and four digits", () => {
    expect(randomName(() => 0)).toBe("user_1000");
    expect(randomName(() => 0.99999)).toBe("user_9999");
    expect(randomName()).toMatch(/^user_\d{4}$/);
  });
});

describe("message expiry", () => {
  it("expires messages a day old, and schedules the next deletion", () => {
    const day = 24 * 60 * 60 * 1_000;
    expect(MESSAGE_LIFETIME).toBe(day);
    expect(expiryCutoff(day + 5)).toBe(5);
    expect(nextExpiry(5)).toBe(day + 5);
  });
});

describe("allowSend", () => {
  it("allows up to the limit within the window", () => {
    let recent: number[] = [];
    for (let index = 0; index < SEND_LIMIT; index += 1) {
      const result = allowSend(recent, 1_000 + index);
      expect(result.allowed).toBe(true);
      recent = result.recent;
    }
    expect(allowSend(recent, 1_010).allowed).toBe(false);
  });

  it("allows again once the old ones leave the window", () => {
    const recent = Array.from({ length: SEND_LIMIT }, (_, index) => index);
    expect(allowSend(recent, SEND_WINDOW + SEND_LIMIT)).toEqual({
      allowed: true,
      recent: [SEND_WINDOW + SEND_LIMIT],
    });
  });
});

describe("typingSignal", () => {
  it("says so on the first key, then once every interval", () => {
    const first = typingSignal(quietTyping, true, 1_000);
    expect(first).toEqual({ send: true, signal: { on: true, sent: 1_000 } });
    const soon = typingSignal(first.signal, true, 1_000 + TYPING_EVERY - 1);
    expect(soon.send).toBeNull();
    const later = typingSignal(soon.signal, true, 1_000 + TYPING_EVERY);
    expect(later).toEqual({
      send: true,
      signal: { on: true, sent: 1_000 + TYPING_EVERY },
    });
  });

  it("says it stopped once when the draft is cleared", () => {
    const typing = typingSignal(quietTyping, true, 1_000).signal;
    const cleared = typingSignal(typing, false, 1_500);
    expect(cleared).toEqual({ send: false, signal: quietTyping });
    expect(typingSignal(cleared.signal, false, 1_600).send).toBeNull();
  });
});

describe("allowTyping", () => {
  it("passes on that someone is typing at most once per gap", () => {
    expect(allowTyping(undefined, true, 5)).toBe(true);
    const last = { at: 100, active: true };
    expect(allowTyping(last, true, 100 + TYPING_MIN_GAP - 1)).toBe(false);
    expect(allowTyping(last, true, 100 + TYPING_MIN_GAP)).toBe(true);
  });

  it("always passes on a stop after typing, and only then", () => {
    expect(allowTyping({ at: 100, active: true }, false, 101)).toBe(true);
    expect(allowTyping({ at: 100, active: false }, false, 900)).toBe(false);
    expect(allowTyping(undefined, false, 900)).toBe(false);
  });
});

describe("parseClientMessage", () => {
  it("reads joins, renames, and messages, cleaned", () => {
    expect(parseClientMessage('{"type":"join","name":" kiana "}')).toEqual({
      type: "join",
      name: "kiana",
    });
    expect(parseClientMessage('{"type":"rename","name":"k"}')).toEqual({
      type: "rename",
      name: "k",
    });
    expect(parseClientMessage('{"type":"say","text":"hi\\n"}')).toEqual({
      type: "say",
      text: "hi",
    });
  });

  it("reads typing signals", () => {
    expect(parseClientMessage('{"type":"typing"}')).toEqual({
      type: "typing",
      active: true,
    });
    expect(parseClientMessage('{"type":"typing","active":false}')).toEqual({
      type: "typing",
      active: false,
    });
  });

  it("ignores empty, unknown, oversized, and broken frames", () => {
    expect(parseClientMessage('{"type":"say","text":"  "}')).toBeNull();
    expect(parseClientMessage('{"type":"kick"}')).toBeNull();
    expect(parseClientMessage("[]")).toBeNull();
    expect(parseClientMessage("{")).toBeNull();
    expect(
      parseClientMessage(`{"type":"say","text":"${"a".repeat(3_000)}"}`),
    ).toBeNull();
    expect(parseClientMessage(new ArrayBuffer(4))).toBeNull();
  });
});

describe("parseServerMessage", () => {
  const message = { id: "m", from: "p", name: "kiana", text: "hi", at: 1 };

  it("reads a welcome, dropping malformed entries", () => {
    const raw = JSON.stringify({
      type: "welcome",
      you: "p",
      people: [{ id: "p", name: "kiana" }, { id: 3 }],
      messages: [message, { id: "x" }],
    });
    expect(parseServerMessage(raw)).toEqual({
      type: "welcome",
      you: "p",
      people: [{ id: "p", name: "kiana" }],
      messages: [message],
    });
  });

  it("reads people, messages, and notices", () => {
    expect(
      parseServerMessage(JSON.stringify({ type: "people", people: [] })),
    ).toEqual({ type: "people", people: [] });
    expect(
      parseServerMessage(JSON.stringify({ type: "message", message })),
    ).toEqual({ type: "message", message });
    expect(
      parseServerMessage(JSON.stringify({ type: "notice", text: "slow" })),
    ).toEqual({ type: "notice", text: "slow" });
  });

  it("reads who is verified and what is mine, and only a true mark", () => {
    const raw = JSON.stringify({
      type: "welcome",
      you: "p",
      people: [
        { id: "p", name: "kiana", verified: true },
        { id: "q", name: "amy", verified: "yes" },
      ],
      messages: [
        { ...message, verified: true, mine: true },
        { ...message, id: "n", mine: 1 },
      ],
    });
    expect(parseServerMessage(raw)).toEqual({
      type: "welcome",
      you: "p",
      people: [
        { id: "p", name: "kiana", verified: true },
        { id: "q", name: "amy" },
      ],
      messages: [
        { ...message, verified: true, mine: true },
        { ...message, id: "n" },
      ],
    });
  });

  it("reads typing", () => {
    const typing = { type: "typing", id: "p", name: "amy", active: true };
    expect(parseServerMessage(JSON.stringify(typing))).toEqual(typing);
    expect(
      parseServerMessage(JSON.stringify({ ...typing, active: "yes" })),
    ).toBeNull();
  });

  it("ignores what it does not know", () => {
    expect(parseServerMessage("pong")).toBeNull();
    expect(parseServerMessage('{"type":"later"}')).toBeNull();
    expect(parseServerMessage('{"type":"message"}')).toBeNull();
  });
});
