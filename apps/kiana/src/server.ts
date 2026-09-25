import { env } from "cloudflare:workers";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { AUTH_PATH } from "./lib/auth";
import { CHAT_PATH } from "./lib/chat";
import { FAVORITES_PATH } from "./lib/favorites";
import { MUYU_PATH } from "./lib/muyu";
import { type Account, withAccount } from "./server/account";
import { accountOf, handleAuth } from "./server/auth";
import { handleFavorites } from "./server/favorites";

export { ChatRoom } from "./server/chat-room";
export { WoodenFish } from "./server/wooden-fish";

/**
 * What the Worker answers ahead of TanStack Start, each told who is asking
 * if they signed in: the live apps' WebSockets, each served by one Durable
 * Object that all visitors share (everyone talks in the one chat room, and
 * adds to the one wooden fish's merit), and the viewer's favorites.
 */
const routes: Record<
  string,
  (request: Request, account: Account | null) => Promise<Response> | Response
> = {
  [CHAT_PATH]: (request, account) =>
    env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName("lobby")).fetch(
      withAccount(request, account),
    ),
  [MUYU_PATH]: (request, account) =>
    env.WOODEN_FISH.get(env.WOODEN_FISH.idFromName("muyu")).fetch(
      withAccount(request, account),
    ),
  [FAVORITES_PATH]: handleFavorites,
};

/**
 * The Worker's entry: TanStack Start's own for every page, with signing
 * in and `routes` in front of it, and the Durable Object classes exported
 * so Cloudflare can run them.
 */
export default createServerEntry({
  async fetch(request, ...rest) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(`${AUTH_PATH}/`)) return handleAuth(request);
    const route = routes[url.pathname];
    if (!route) return handler.fetch(request, ...rest);
    // Only the site's own pages may use these, not scripts on other sites
    // riding on a visitor's browser.
    const origin = request.headers.get("Origin");
    if (origin && new URL(origin).host !== url.host) {
      return new Response("Forbidden", { status: 403 });
    }
    // Who is asking comes from the Worker's check of their session, not
    // from the browser.
    return route(request, await accountOf(request));
  },
});
