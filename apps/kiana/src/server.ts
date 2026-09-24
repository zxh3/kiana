import { env } from "cloudflare:workers";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { CHAT_PATH } from "./lib/chat";
import { MUYU_PATH } from "./lib/muyu";

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
 * The Worker's entry: TanStack Start's own for every page, with the pod's
 * live apps in front of it, and their Durable Object classes exported so
 * Cloudflare can run them.
 */
export default createServerEntry({
  fetch(request, ...rest) {
    const url = new URL(request.url);
    const stub = sockets[url.pathname];
    if (!stub) return handler.fetch(request, ...rest);
    // Only the site's own pages may connect, not scripts on other sites
    // riding on a visitor's browser.
    const origin = request.headers.get("Origin");
    if (origin && new URL(origin).host !== url.host) {
      return new Response("Forbidden", { status: 403 });
    }
    return stub().fetch(request);
  },
});
