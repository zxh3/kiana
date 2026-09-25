import { env } from "cloudflare:workers";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { AUTH_PATH } from "./lib/auth";
import { CHAT_PATH } from "./lib/chat";
import { FAVORITES_PATH } from "./lib/favorites";
import { MUYU_PATH } from "./lib/muyu";
import { fromElsewhere } from "./lib/origin";
import type { RequestContext } from "./lib/request-context";
import { type Account, withAccount } from "./server/account";
import { accountOf, handleAuth, photoAdminOf } from "./server/auth";
import { handleFavorites } from "./server/favorites";
import { hiddenPhotoIds } from "./server/hidden-photos";

export { ChatRoom } from "./server/chat-room";
export { WoodenFish } from "./server/wooden-fish";

/**
 * What the Worker answers ahead of TanStack Start, each told who is asking
 * if they signed in: the live apps' WebSockets, each served by one Durable
 * Object that all visitors share (everyone talks in the one chat room, and
 * adds to the one wooden fish's merit), and the viewer's favorites.
 */
type Route = (
  request: Request,
  account: Account | null,
) => Promise<Response> | Response;

/**
 * A live app's WebSocket, passed on with who is asking to its one Durable
 * Object. The name picks the object, and with it everything it stores,
 * so it must not change.
 */
const liveApp =
  (namespace: DurableObjectNamespace, name: string): Route =>
  (request, account) =>
    namespace.getByName(name).fetch(withAccount(request, account));

const routes: Record<string, Route> = {
  [CHAT_PATH]: liveApp(env.CHAT_ROOM, "lobby"),
  [MUYU_PATH]: liveApp(env.WOODEN_FISH, "muyu"),
  [FAVORITES_PATH]: handleFavorites,
};

/** Where TanStack Start answers the browser's calls to server functions. */
const SERVER_FUNCTIONS_PATH = "/_serverFn/";

/**
 * The Worker's entry: TanStack Start's own for every page, with signing
 * in and `routes` in front of it, and the Durable Object classes exported
 * so Cloudflare can run them. TanStack Start's server functions reach the
 * database through the request's context.
 */
export default createServerEntry({
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(`${AUTH_PATH}/`)) return handleAuth(request);
    const route = routes[url.pathname] as Route | undefined;
    // Only the site's own pages may use these, not scripts on other sites
    // riding on a visitor's browser.
    if (
      (route || url.pathname.startsWith(SERVER_FUNCTIONS_PATH)) &&
      fromElsewhere(request.headers.get("Origin"), url.host)
    ) {
      return new Response("Forbidden", { status: 403 });
    }
    if (!route) {
      const context: RequestContext = {
        hiddenPhotoIds,
        photoAdmin: () => photoAdminOf(request),
      };
      return handler.fetch(request, { context });
    }
    // Who is asking comes from the Worker's check of their session, not
    // from the browser.
    return route(request, await accountOf(request));
  },
});
