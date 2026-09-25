import { DurableObject } from "cloudflare:workers";

import {
  allowHistory,
  allowSend,
  allowTyping,
  type ChatMessage,
  type LastTyping,
  nameFor,
  PAGE_SIZE,
  type Person,
  parseClientMessage,
  type ServerMessage,
} from "../lib/chat";
import { PING, PONG } from "../lib/live-socket";
import { type Account, readAccount } from "./account";

/**
 * What the room remembers about each connection. It lives on the socket
 * itself, so it survives the room being put to sleep between messages.
 */
type Guest = {
  id: string;
  /** Unset until the browser joins with a name. */
  name: string | null;
  /** When its recent messages were sent, for the rate limit. */
  sent: number[];
  /** The last typing signal passed on for it, for that signal's limit. */
  typed?: LastTyping;
  /** When it last asked for earlier messages, for that request's limit. */
  paged?: number;
  /**
   * Who it signed in as, if it did: then it goes by its Google name, and
   * cannot pick another.
   */
  account?: Account | null;
};

/** Someone connected who has joined, with their socket. */
type Joined = { socket: WebSocket; guest: Guest & { name: string } };

type MessageRow = {
  id: string;
  sender: string;
  name: string;
  text: string;
  at: number;
  verified: number;
  account: string | null;
};

/**
 * The click-wheel player's chat room: one Durable Object that every
 * browser with the Chat Room open connects to by WebSocket. It keeps every
 * message in its SQLite storage and sends whoever joins the latest page of
 * them; scrolling up to the top asks for the page before, and so on. It
 * tells everyone who is here whenever someone joins, leaves, or changes
 * their name, and passes on who is typing without keeping it: that is only
 * ever live.
 *
 * Someone signed in with Google goes by their first name, marked as
 * verified, in place of a name they picked: the Worker checks their
 * session and passes their account on with the connection.
 *
 * It uses the WebSocket Hibernation API, so a quiet room is put to sleep
 * with its connections still open, and pings are answered without waking
 * it. The rules (names, limits, what counts as a message) are in
 * `lib/chat.ts`.
 */
export class ChatRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL,
        sender TEXT NOT NULL,
        name TEXT NOT NULL,
        text TEXT NOT NULL,
        at INTEGER NOT NULL
      )`);
    // Whether each message was sent by someone signed in, and by which
    // account, added once signing in came, to a table that may already
    // hold messages.
    const columns = new Set(
      sql
        .exec<{ name: string }>("PRAGMA table_info(messages)")
        .toArray()
        .map((column) => column.name),
    );
    if (!columns.has("verified")) {
      sql.exec(
        "ALTER TABLE messages ADD COLUMN verified INTEGER NOT NULL DEFAULT 0",
      );
    }
    if (!columns.has("account")) {
      sql.exec("ALTER TABLE messages ADD COLUMN account TEXT");
    }
    // Earlier pages start from a message's id, found by this.
    sql.exec("CREATE INDEX IF NOT EXISTS messages_id ON messages (id)");
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const guest: Guest = {
      id: crypto.randomUUID(),
      name: null,
      sent: [],
      account: readAccount(request),
    };
    server.serializeAttachment(guest);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, data: string | ArrayBuffer) {
    const message = parseClientMessage(data);
    const guest = guestOf(socket);
    if (!message || !guest) return;
    if (message.type === "join" || message.type === "rename") {
      this.join(socket, guest, message.type, message.name);
      return;
    }
    // Only someone who has joined can talk, and not too fast.
    if (guest.name === null) return;
    const joined = { socket, guest: { ...guest, name: guest.name } };
    if (message.type === "typing") this.typing(joined, message.active);
    else if (message.type === "history") this.page(joined, message.before);
    else this.say(joined, message.text);
  }

  /**
   * Joins the room, with the latest page of messages, or changes name.
   * Someone signed in goes by their account's name, whatever they send.
   */
  private join(
    socket: WebSocket,
    guest: Guest,
    type: "join" | "rename",
    picked: string,
  ) {
    if (type === "rename" && guest.account) return;
    const joining = guest.name === null;
    socket.serializeAttachment({
      ...guest,
      name: nameFor(guest.account, picked),
    });
    if (joining) {
      send(socket, {
        type: "welcome",
        you: guest.id,
        people: this.people(),
        ...this.messages(guest.account?.id),
      });
    }
    this.broadcast({ type: "people", people: this.people() });
  }

  /** Passes on that someone is typing, or stopped, without keeping it. */
  private typing({ socket, guest }: Joined, active: boolean) {
    const now = Date.now();
    if (!allowTyping(guest.typed, active, now)) return;
    socket.serializeAttachment({ ...guest, typed: { at: now, active } });
    this.broadcast(
      { type: "typing", id: guest.id, name: guest.name, active },
      socket,
    );
  }

  /** Sends the one who asked the page of messages before `before`. */
  private page({ socket, guest }: Joined, before: string) {
    const now = Date.now();
    if (!allowHistory(guest.paged, now)) return;
    socket.serializeAttachment({ ...guest, paged: now });
    send(socket, {
      type: "history",
      ...this.messages(guest.account?.id, before),
    });
  }

  /** Keeps a message, and tells everyone, unless it comes too fast. */
  private say({ socket, guest }: Joined, text: string) {
    const now = Date.now();
    const limit = allowSend(guest.sent, now);
    socket.serializeAttachment({ ...guest, sent: limit.recent });
    if (!limit.allowed) {
      send(socket, { type: "notice", text: "Slow down a little." });
      return;
    }
    const said: ChatMessage = {
      id: crypto.randomUUID(),
      from: guest.id,
      name: guest.name,
      text,
      at: now,
    };
    if (guest.account) said.verified = true;
    this.ctx.storage.sql.exec(
      "INSERT INTO messages (id, sender, name, text, at, verified, account) VALUES (?, ?, ?, ?, ?, ?, ?)",
      said.id,
      said.from,
      said.name,
      said.text,
      said.at,
      said.verified ? 1 : 0,
      guest.account?.id ?? null,
    );
    // Each of the sender's own connections, on any device, hears it as
    // theirs; the account itself is never sent.
    for (const listener of this.joined()) {
      const mine =
        guest.account != null &&
        listener.guest.account?.id === guest.account.id;
      send(listener.socket, {
        type: "message",
        message: mine ? { ...said, mine } : said,
      });
    }
  }

  /**
   * A room made before messages were kept for good may still have an alarm
   * set to delete the oldest; there is nothing left for it to do.
   */
  async alarm() {}

  async webSocketClose(socket: WebSocket) {
    this.leave(socket);
  }

  async webSocketError(socket: WebSocket) {
    this.leave(socket);
  }

  /** Tells everyone left who is still here. */
  private leave(socket: WebSocket) {
    this.broadcast({ type: "people", people: this.people(socket) }, socket);
  }

  /** Everyone connected who has joined, apart from one on its way out. */
  private joined(except?: WebSocket): Joined[] {
    return this.ctx.getWebSockets().flatMap((socket) => {
      if (socket === except) return [];
      const guest = guestOf(socket);
      return guest?.name
        ? [{ socket, guest: { ...guest, name: guest.name } }]
        : [];
    });
  }

  /** Who is here, apart from one on their way out. */
  private people(leaving?: WebSocket): Person[] {
    return this.joined(leaving).map(({ guest }) => {
      const person: Person = { id: guest.id, name: guest.name };
      if (guest.account) person.verified = true;
      return person;
    });
  }

  /**
   * A page of messages, oldest first: the latest, or those just before
   * the one with the id `before`, and whether there are earlier ones.
   * Those sent by `account` are marked as its own.
   */
  private messages(account?: string, before?: string) {
    const rows = this.ctx.storage.sql
      .exec<MessageRow>(
        `SELECT id, sender, name, text, at, verified, account FROM messages
         WHERE seq < COALESCE((SELECT seq FROM messages WHERE id = ?), 9e18)
         ORDER BY seq DESC LIMIT ?`,
        before ?? null,
        PAGE_SIZE + 1,
      )
      .toArray();
    const messages = rows
      .slice(0, PAGE_SIZE)
      .reverse()
      .map((row) => {
        const message: ChatMessage = {
          id: row.id,
          from: row.sender,
          name: row.name,
          text: row.text,
          at: row.at,
        };
        if (row.verified) message.verified = true;
        if (account && row.account === account) message.mine = true;
        return message;
      });
    return { messages, more: rows.length > PAGE_SIZE };
  }

  private broadcast(message: ServerMessage, except?: WebSocket) {
    for (const { socket } of this.joined(except)) send(socket, message);
  }
}

function guestOf(socket: WebSocket) {
  return socket.deserializeAttachment() as Guest | null;
}

/** Sends to one socket, which may already be closing. */
function send(socket: WebSocket, message: ServerMessage) {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // It left; its close handler tells everyone else.
  }
}
