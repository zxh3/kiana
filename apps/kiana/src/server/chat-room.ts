import { DurableObject } from "cloudflare:workers";

import {
  allowSend,
  allowTyping,
  type ChatMessage,
  expiryCutoff,
  HISTORY_SIZE,
  type LastTyping,
  nextExpiry,
  type Person,
  PING,
  PONG,
  parseClientMessage,
  type ServerMessage,
} from "../lib/chat";

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
};

/**
 * The click-wheel player's chat room: one Durable Object that every
 * browser with the Chat Room open connects to by WebSocket. It keeps the
 * last messages in its SQLite storage, sends them to whoever joins, and
 * tells everyone who is here whenever someone joins, leaves, or changes
 * their name. It passes on who is typing without keeping it: that is only
 * ever live. Messages are deleted a day after they are sent, by an alarm
 * set for the oldest one, so they go even while nobody is here.
 *
 * It uses the WebSocket Hibernation API, so a quiet room is put to sleep
 * with its connections still open, and pings are answered without waking
 * it. The rules (names, limits, what counts as a message) are in
 * `lib/chat.ts`.
 */
export class ChatRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL,
        sender TEXT NOT NULL,
        name TEXT NOT NULL,
        text TEXT NOT NULL,
        at INTEGER NOT NULL
      )`);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const guest: Guest = { id: crypto.randomUUID(), name: null, sent: [] };
    server.serializeAttachment(guest);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, data: string | ArrayBuffer) {
    const message = parseClientMessage(data);
    const guest = socket.deserializeAttachment() as Guest;
    if (!message) return;

    if (message.type === "join" || message.type === "rename") {
      const joining = guest.name === null;
      socket.serializeAttachment({ ...guest, name: message.name });
      if (joining) {
        // In case the alarm has not run yet, nothing expired is sent.
        this.expire(Date.now());
        send(socket, {
          type: "welcome",
          you: guest.id,
          people: this.people(),
          messages: this.history(),
        });
      }
      this.broadcast({ type: "people", people: this.people() });
      return;
    }

    // Only someone who has joined can talk, and not too fast.
    if (guest.name === null) return;
    const now = Date.now();

    if (message.type === "typing") {
      if (!allowTyping(guest.typed, message.active, now)) return;
      socket.serializeAttachment({
        ...guest,
        typed: { at: now, active: message.active },
      });
      this.broadcast(
        {
          type: "typing",
          id: guest.id,
          name: guest.name,
          active: message.active,
        },
        socket,
      );
      return;
    }

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
      text: message.text,
      at: now,
    };
    const sql = this.ctx.storage.sql;
    sql.exec(
      "INSERT INTO messages (id, sender, name, text, at) VALUES (?, ?, ?, ?, ?)",
      said.id,
      said.from,
      said.name,
      said.text,
      said.at,
    );
    sql.exec(
      "DELETE FROM messages WHERE seq <= (SELECT MAX(seq) FROM messages) - ?",
      HISTORY_SIZE,
    );
    this.expire(now);
    this.broadcast({ type: "message", message: said });
  }

  async alarm() {
    this.expire(Date.now());
  }

  /**
   * Deletes the messages a day old, and sets the alarm for when the oldest
   * one left will be, or clears it once none are left.
   */
  private expire(now: number) {
    const sql = this.ctx.storage.sql;
    sql.exec("DELETE FROM messages WHERE at <= ?", expiryCutoff(now));
    const [oldest] = sql
      .exec<{ at: number }>("SELECT MIN(at) AS at FROM messages")
      .toArray();
    if (oldest?.at != null) {
      this.ctx.storage.setAlarm(nextExpiry(oldest.at));
    } else {
      this.ctx.storage.deleteAlarm();
    }
  }

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
  private people(leaving?: WebSocket): Person[] {
    return this.ctx
      .getWebSockets()
      .filter((socket) => socket !== leaving)
      .flatMap((socket) => {
        const guest = socket.deserializeAttachment() as Guest | null;
        return guest?.name ? [{ id: guest.id, name: guest.name }] : [];
      });
  }

  private history(): ChatMessage[] {
    return this.ctx.storage.sql
      .exec<{
        id: string;
        sender: string;
        name: string;
        text: string;
        at: number;
      }>("SELECT id, sender, name, text, at FROM messages ORDER BY seq")
      .toArray()
      .map((row) => ({
        id: row.id,
        from: row.sender,
        name: row.name,
        text: row.text,
        at: row.at,
      }));
  }

  private broadcast(message: ServerMessage, except?: WebSocket) {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except) continue;
      const guest = socket.deserializeAttachment() as Guest | null;
      if (guest?.name != null) send(socket, message);
    }
  }
}

/** Sends to one socket, which may already be closing. */
function send(socket: WebSocket, message: ServerMessage) {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // It left; its close handler tells everyone else.
  }
}
