import { DurableObject } from "cloudflare:workers";

import { PING, PONG } from "../lib/live-socket";
import {
  type KnockBudget,
  type MuyuServerMessage,
  parseMuyuClientMessage,
  takeKnocks,
} from "../lib/muyu";
import { readAccount } from "./account";

/**
 * What the wooden fish remembers about each connection, on the socket
 * itself so it survives being put to sleep: its knocks this second, for
 * the limit, and the account it signed in as, if it did.
 */
type Knocker = { budget?: KnockBudget; account?: string };

/**
 * The electronic wooden fish's merit, 猫德 (cat merit, after its 功德):
 * one count that everyone adds to, one for each pat of Kiana's head,
 * starting from nothing. Every browser with it open connects by
 * WebSocket, and each new total goes to them all, so the count climbs as
 * other people pat too.
 *
 * Someone signed in with Google also has merit of their own, kept here by
 * their account, so it is the same on every device; each of their
 * browsers hears it with the total. A guest's own merit stays in their
 * browser.
 *
 * It uses the WebSocket Hibernation API, as the chat room does, and keeps
 * the counts in its SQLite storage. The limits are in `lib/muyu.ts`.
 */
export class WoodenFish extends DurableObject<Env> {
  private total: number;
  /** Accounts' own merit, read from storage as they connect. */
  private mine = new Map<string, number>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec(`
      CREATE TABLE IF NOT EXISTS merit (
        id INTEGER PRIMARY KEY CHECK (id = 0),
        total INTEGER NOT NULL
      )`);
    sql.exec(`
      CREATE TABLE IF NOT EXISTS mine (
        account TEXT PRIMARY KEY,
        merit INTEGER NOT NULL
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
    const knocker: Knocker = { account: readAccount(request)?.id };
    server.serializeAttachment(knocker);
    // The newcomer hears the total, and everyone that one more is here.
    this.broadcast(this.merit());
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, data: string | ArrayBuffer) {
    const message = parseMuyuClientMessage(data);
    if (!message) return;
    const knocker = knockerOf(socket);
    const taken = takeKnocks(knocker.budget, message.count, Date.now());
    socket.serializeAttachment({ ...knocker, budget: taken.budget });
    if (taken.accepted > 0) {
      this.total += taken.accepted;
      const sql = this.ctx.storage.sql;
      sql.exec("UPDATE merit SET total = ? WHERE id = 0", this.total);
      if (knocker.account) {
        const merit = this.meritOf(knocker.account) + taken.accepted;
        this.mine.set(knocker.account, merit);
        sql.exec(
          "INSERT INTO mine (account, merit) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET merit = excluded.merit",
          knocker.account,
          merit,
        );
      }
    }
    // The sender hears that its knocks are in, whether or not they all
    // counted, so it stops showing them as on their way.
    this.send(socket, { ...this.merit(), ack: message.seq });
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

  /** An account's own merit so far. */
  private meritOf(account: string) {
    const known = this.mine.get(account);
    if (known !== undefined) return known;
    const [row] = this.ctx.storage.sql
      .exec<{ merit: number }>(
        "SELECT merit FROM mine WHERE account = ?",
        account,
      )
      .toArray();
    const merit = row?.merit ?? 0;
    this.mine.set(account, merit);
    return merit;
  }

  private broadcast(message: MuyuServerMessage, except?: WebSocket) {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== except) this.send(socket, message);
    }
  }

  /**
   * Sends to one socket, which may already be closing, with its account's
   * own merit if it signed in.
   */
  private send(socket: WebSocket, message: MuyuServerMessage) {
    const { account } = knockerOf(socket);
    const personal = account
      ? { ...message, mine: this.meritOf(account) }
      : message;
    try {
      socket.send(JSON.stringify(personal));
    } catch {
      // It left; its close handler tells everyone else.
    }
  }
}

function knockerOf(socket: WebSocket): Knocker {
  return (socket.deserializeAttachment() as Knocker | null) ?? {};
}
