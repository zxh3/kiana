/**
 * What the live apps' WebSockets (Chat and 电子木鱼) share, in the
 * browser and in their Durable Objects: the words that keep a quiet
 * connection open. The Durable Objects answer them without waking.
 */

/** What the browser sends to keep a quiet connection open, and the reply. */
export const PING = "ping";
export const PONG = "pong";
