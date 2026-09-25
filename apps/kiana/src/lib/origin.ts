/**
 * Whether a request came from a page on another site, by its `Origin`
 * header, so the Worker refuses it. A request without one (not sent by a
 * page's script) is let through. One whose origin is not a web address,
 * such as the "null" a sandboxed frame sends, counts as another site.
 */
export function fromElsewhere(origin: string | null, host: string) {
  if (!origin) return false;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
