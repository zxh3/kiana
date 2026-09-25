import { env } from "cloudflare:workers";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { AUTH_PATH } from "./lib/auth";
import { CHAT_PATH } from "./lib/chat";
import { FAVORITES_PATH } from "./lib/favorites";
import { MUYU_PATH } from "./lib/muyu";
import { withAccount } from "./server/account";
import { accountOf, handleAuth } from "./server/auth";
import { handleFavorites } from "./server/favorites";

export { ChatRoom } from "./server/chat-room";
export { WoodenFish } from "./server/wooden-fish";

/**
 * The live apps' WebSockets, each served by one Durable Object that all
 * visitors share: everyone talks in the one chat room, and adds to the
 * one wooden fish's merit.
 */
const sockets: Record<string, () => DurableObjectStub> = {
  [CHAT_PATH]: () => env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName("lobby")),
  [MUYU_PATH]: () => env.WOODEN_FISH.get(env.WOODEN_FISH.idFromName("muyu")),
};

/**
 * The Worker's entry: TanStack Start's own for every page, with signing
 * in, favorites, and the pod's live apps in front of it, and their Durable
 * Object classes exported so Cloudflare can run them.
 */
export default createServerEntry({
  async fetch(request, ...rest) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(`${AUTH_PATH}/`)) return handleAuth(request);
    const stub = sockets[url.pathname];
    if (!stub && url.pathname !== FAVORITES_PATH) {
      return handler.fetch(request, ...rest);
    }
    // Only the site's own pages may use these, not scripts on other sites
    // riding on a visitor's browser.
    const origin = request.headers.get("Origin");
    if (origin && new URL(origin).host !== url.host) {
      return new Response("Forbidden", { status: 403 });
    }
    // Who is asking, if they signed in, comes from the Worker's check of
    // their session rather than from the browser.
    const account = await accountOf(request);
    if (!stub) return handleFavorites(request, account);
    return stub().fetch(withAccount(request, account));
  },
});
