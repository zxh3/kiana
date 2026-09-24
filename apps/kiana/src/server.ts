import { env } from "cloudflare:workers";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { CHAT_PATH } from "./lib/chat";

export { ChatRoom } from "./server/chat-room";

/** Everyone talks in the one room. */
const ROOM = "lobby";

/**
 * The Worker's entry: TanStack Start's own for every page, with the chat
 * room's WebSocket in front of it, and the room's Durable Object class
 * exported so Cloudflare can run it.
 */
export default createServerEntry({
  fetch(request, ...rest) {
    const url = new URL(request.url);
    if (url.pathname !== CHAT_PATH) return handler.fetch(request, ...rest);
    // Only the site's own pages may connect, not scripts on other sites
    // riding on a visitor's browser.
    const origin = request.headers.get("Origin");
    if (origin && new URL(origin).host !== url.host) {
      return new Response("Forbidden", { status: 403 });
    }
    const room = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(ROOM));
    return room.fetch(request);
  },
});
