import { DurableObject } from "cloudflare:workers";

import { PING, PONG } from "../lib/chat";
import {
  type KnockBudget,
  type MuyuServerMessage,
  parseMuyuClientMessage,
  takeKnocks,
} from "../lib/muyu";

/**
 * The electronic wooden fish's merit, 猫德 (cat merit, after its 功德):
 * one count that everyone adds to, one for each pat of Kiana's head,
 * starting from nothing. Every browser with it open connects by
 * WebSocket, and each new total goes to them all, so the count climbs as
 * other people pat too.
 *
 * It uses the WebSocket Hibernation API, as the chat room does, and keeps
 * the total in its SQLite storage. The limits are in `lib/muyu.ts`.
 */
export class WoodenFish extends DurableObject<Env> {
  private total: number;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec(`
      CREATE TABLE IF NOT EXISTS merit (
        id INTEGER PRIMARY KEY CHECK (id = 0),
        total INTEGER NOT NULL
      )`);
    sql.exec("INSERT OR IGNORE INTO merit (id, total) VALUES (0, 0)");
    this.total = sql
      .exec<{ total: number }>("SELECT total FROM merit WHERE id = 0")
      .one().total;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(null);
    // The newcomer hears the total, and everyone that one more is here.
    this.broadcast(this.merit());
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, data: string | ArrayBuffer) {
    const message = parseMuyuClientMessage(data);
    if (!message) return;
    const budget = socket.deserializeAttachment() as KnockBudget | null;
    const taken = takeKnocks(budget ?? undefined, message.count, Date.now());
    socket.serializeAttachment(taken.budget);
    if (taken.accepted > 0) {
      this.total += taken.accepted;
      this.ctx.storage.sql.exec(
        "UPDATE merit SET total = ? WHERE id = 0",
        this.total,
      );
    }
    // The sender hears that its knocks are in, whether or not they all
    // counted, so it stops showing them as on their way.
    send(socket, { ...this.merit(), ack: message.seq });
    if (taken.accepted > 0) this.broadcast(this.merit(), socket);
  }

  async webSocketClose(socket: WebSocket) {
    this.broadcast(this.merit(socket), socket);
  }

  async webSocketError(socket: WebSocket) {
    this.broadcast(this.merit(socket), socket);
  }

  /** The total, and how many are here apart from one on its way out. */
  private merit(leaving?: WebSocket): MuyuServerMessage {
    const here = this.ctx
      .getWebSockets()
      .filter((socket) => socket !== leaving).length;
    return { type: "merit", total: this.total, here };
  }

  private broadcast(message: MuyuServerMessage, except?: WebSocket) {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== except) send(socket, message);
    }
  }
}

/** Sends to one socket, which may already be closing. */
function send(socket: WebSocket, message: MuyuServerMessage) {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // It left; its close handler tells everyone else.
  }
}
