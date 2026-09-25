/**
 * The chat room's wire protocol and its rules, shared by the browser and
 * the Durable Object that runs the room (`src/server/chat-room.ts`). Kept
 * free of both so the rules can be tested on their own.
 */

import { readJsonObject } from "./json";

/** Where the browser opens its WebSocket to the room. */
export const CHAT_PATH = "/api/chat";

/** The longest name, and the longest message, in characters. */
export const NAME_MAX = 16;
export const TEXT_MAX = 200;
/**
 * The room keeps every message. Whoever joins gets the latest this many,
 * and each request for earlier ones, made by scrolling up to the top,
 * brings this many more.
 */
export const PAGE_SIZE = 100;
/** Each person may ask for earlier messages at most this often. */
export const HISTORY_EVERY = 300;
/** Each person may send this many messages in any window this long. */
export const SEND_LIMIT = 5;
export const SEND_WINDOW = 10_000;
/**
 * While someone types, their browser says so at most this often, and the
 * others show them as typing for a little longer than that after the last
 * word, so a steady typist never flickers off between signals.
 */
export const TYPING_EVERY = 2_000;
export const TYPING_SHOWS_FOR = 3_500;
/** The room passes on at most one typing signal this often per person. */
export const TYPING_MIN_GAP = 500;
/** The longest frame the room reads; anything longer is ignored. */
const FRAME_MAX = 2_000;

/**
 * Someone here. `verified` is set for someone signed in with Google, whose
 * name is their account's and cannot be picked by anyone else.
 */
export type Person = { id: string; name: string; verified?: boolean };
export type ChatMessage = {
  id: string;
  /** The sender's person id, for the time they were connected. */
  from: string;
  name: string;
  text: string;
  at: number;
  /** Sent by someone signed in with Google. */
  verified?: boolean;
  /**
   * Sent by the account this browser is signed in with, from any device
   * or visit; the room marks it for that account's connections alone.
   */
  mine?: boolean;
};

/** From the browser to the room. */
export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "rename"; name: string }
  | { type: "say"; text: string }
  /** Started or went on typing (`active`), or cleared what they typed. */
  | { type: "typing"; active: boolean }
  /** The page of messages before the one with this id. */
  | { type: "history"; before: string };

/** From the room to the browser. */
export type ServerMessage =
  | {
      type: "welcome";
      you: string;
      people: Person[];
      /** The latest page, and whether there are earlier messages. */
      messages: ChatMessage[];
      more: boolean;
    }
  /** A page of earlier messages, oldest first, for the one who asked. */
  | { type: "history"; messages: ChatMessage[]; more: boolean }
  | { type: "people"; people: Person[] }
  | { type: "message"; message: ChatMessage }
  | { type: "typing"; id: string; name: string; active: boolean }
  | { type: "notice"; text: string };

// Control characters, and the ones that reorder text around them, which
// could make a name or message draw over its neighbours.
const HIDDEN = /[\p{Cc}‎‏‪-‮⁦-⁩]/gu;

/** One line of plain text, at most `max` characters, or "" if nothing. */
function cleanLine(raw: unknown, max: number) {
  if (typeof raw !== "string") return "";
  const line = raw.replace(HIDDEN, " ").replace(/\s+/g, " ").trim();
  return Array.from(line).slice(0, max).join("").trim();
}

/** A name as the room shows it, or "" if there is nothing to show. */
export function cleanName(raw: unknown) {
  return cleanLine(raw, NAME_MAX);
}

/** A message as the room shows it, or "" if there is nothing to send. */
export function cleanText(raw: unknown) {
  return cleanLine(raw, TEXT_MAX);
}

/**
 * The name someone goes by: their account's, if they signed in and it has
 * one to show, or else the one they picked.
 */
export function nameFor(
  account: { name: string } | null | undefined,
  picked: string,
) {
  return cleanName(account?.name) || picked;
}

/** A name for someone who has not picked one: user_ and four digits. */
export function randomName(random = Math.random) {
  return `user_${1000 + Math.floor(random() * 9000)}`;
}

/** Whether a request for earlier messages at `now` is not too soon. */
export function allowHistory(last: number | undefined, now: number) {
  return last === undefined || now - last >= HISTORY_EVERY;
}

/**
 * Whether one more message at `now` stays within the limit, given the
 * times of the sender's recent ones, and the times to keep for next time.
 */
export function allowSend(recent: ReadonlyArray<number>, now: number) {
  const kept = recent.filter((at) => now - at < SEND_WINDOW);
  if (kept.length >= SEND_LIMIT) return { allowed: false, recent: kept };
  return { allowed: true, recent: [...kept, now] };
}

/** The last typing signal the room passed on for someone. */
export type LastTyping = { at: number; active: boolean };

/**
 * Whether the room passes on a typing signal at `now`: one that they are
 * typing at most every `TYPING_MIN_GAP`, and one that they stopped only
 * straight after one that they were, so it is never lost to the limit and
 * the two together still cannot flood the room.
 */
export function allowTyping(
  last: LastTyping | undefined,
  active: boolean,
  now: number,
) {
  if (!active) return last?.active === true;
  return !last || now - last.at >= TYPING_MIN_GAP;
}

/** Whether a browser is typing, and when it last said so. */
export type TypingSignal = { on: boolean; sent: number };
export const quietTyping: TypingSignal = { on: false, sent: 0 };

/**
 * What the browser tells the room as the draft changes: that the viewer is
 * typing, the first time and then once every `TYPING_EVERY` while they go
 * on, and that they stopped when they clear the draft. `send` is null when
 * there is nothing new to say.
 */
export function typingSignal(
  signal: TypingSignal,
  hasText: boolean,
  now: number,
): { send: boolean | null; signal: TypingSignal } {
  if (!hasText) {
    return { send: signal.on ? false : null, signal: quietTyping };
  }
  if (signal.on && now - signal.sent < TYPING_EVERY) {
    return { send: null, signal };
  }
  return { send: true, signal: { on: true, sent: now } };
}

/** What a browser sent, cleaned, or null for anything else. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  const data = readJsonObject(raw, FRAME_MAX);
  if (!data) return null;
  if (data.type === "join" || data.type === "rename") {
    const name = cleanName(data.name);
    return name ? { type: data.type, name } : null;
  }
  if (data.type === "say") {
    const text = cleanText(data.text);
    return text ? { type: "say", text } : null;
  }
  if (data.type === "typing") {
    return { type: "typing", active: data.active !== false };
  }
  if (
    data.type === "history" &&
    typeof data.before === "string" &&
    data.before.length > 0 &&
    data.before.length <= 64
  ) {
    return { type: "history", before: data.before };
  }
  return null;
}

function parsePerson(raw: unknown): Person | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { id, name, verified } = raw as Record<string, unknown>;
  if (typeof id !== "string" || typeof name !== "string") return null;
  return verified === true ? { id, name, verified } : { id, name };
}

function parseChatMessages(raw: unknown[]) {
  return raw.map(parseChatMessage).filter((message) => message !== null);
}

function parsePeople(raw: unknown) {
  if (!Array.isArray(raw)) return null;
  return raw.map(parsePerson).filter((person) => person !== null);
}

function parseChatMessage(raw: unknown): ChatMessage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { id, from, name, text, at, verified, mine } = raw as Record<
    string,
    unknown
  >;
  if (
    typeof id !== "string" ||
    typeof from !== "string" ||
    typeof name !== "string" ||
    typeof text !== "string" ||
    typeof at !== "number"
  ) {
    return null;
  }
  const message: ChatMessage = { id, from, name, text, at };
  if (verified === true) message.verified = true;
  if (mine === true) message.mine = true;
  return message;
}

/**
 * What the room sent, or null for anything the browser does not know,
 * so a newer room never breaks an open page.
 */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== "string") return null;
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    data = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (data.type === "welcome") {
    const people = parsePeople(data.people);
    if (
      typeof data.you !== "string" ||
      !people ||
      !Array.isArray(data.messages)
    )
      return null;
    return {
      type: "welcome",
      you: data.you,
      people,
      messages: parseChatMessages(data.messages),
      more: data.more === true,
    };
  }
  if (data.type === "history" && Array.isArray(data.messages)) {
    return {
      type: "history",
      messages: parseChatMessages(data.messages),
      more: data.more === true,
    };
  }
  if (data.type === "people") {
    const people = parsePeople(data.people);
    return people ? { type: "people", people } : null;
  }
  if (data.type === "message") {
    const message = parseChatMessage(data.message);
    return message ? { type: "message", message } : null;
  }
  if (
    data.type === "typing" &&
    typeof data.id === "string" &&
    typeof data.name === "string" &&
    typeof data.active === "boolean"
  ) {
    return {
      type: "typing",
      id: data.id,
      name: data.name,
      active: data.active,
    };
  }
  if (data.type === "notice" && typeof data.text === "string") {
    return { type: "notice", text: data.text };
  }
  return null;
}
