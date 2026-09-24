/**
 * Someone signed in with Google, as the Worker vouches for them to the
 * live apps' Durable Objects: their account's id, which stays the same on
 * every device, and their first name.
 */
export type Account = { id: string; name: string };

/**
 * The header a WebSocket's request carries its account in, from the
 * Worker to the Durable Object. Only the Worker can reach the Durable
 * Objects, and it always sets or removes the header, so a browser cannot
 * send its own.
 */
const ACCOUNT_HEADER = "X-Kiana-Account";

/** The request, carrying `account` on to a Durable Object, or no one. */
export function withAccount(request: Request, account: Account | null) {
  const headers = new Headers(request.headers);
  headers.delete(ACCOUNT_HEADER);
  // Encoded, since a header holds only ASCII and names need not be.
  if (account) {
    headers.set(ACCOUNT_HEADER, encodeURIComponent(JSON.stringify(account)));
  }
  return new Request(request, { headers });
}

/** The account a request was passed on with, or null for a guest. */
export function readAccount(request: Request): Account | null {
  const raw = request.headers.get(ACCOUNT_HEADER);
  if (!raw) return null;
  try {
    const { id, name } = JSON.parse(decodeURIComponent(raw));
    return typeof id === "string" && typeof name === "string"
      ? { id, name }
      : null;
  } catch {
    return null;
  }
}
