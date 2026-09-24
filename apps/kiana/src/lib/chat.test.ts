import { describe, expect, it } from "vitest";

import {
  allowSend,
  cleanName,
  cleanText,
  expiryCutoff,
  MESSAGE_LIFETIME,
  NAME_MAX,
  nextExpiry,
  parseClientMessage,
  parseServerMessage,
  randomName,
  SEND_LIMIT,
  SEND_WINDOW,
  TEXT_MAX,
} from "./chat";

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

  it("ignores what it does not know", () => {
    expect(parseServerMessage("pong")).toBeNull();
    expect(parseServerMessage('{"type":"later"}')).toBeNull();
    expect(parseServerMessage('{"type":"message"}')).toBeNull();
  });
});
