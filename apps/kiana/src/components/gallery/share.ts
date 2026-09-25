import { copyText } from "./copy-text";

/** The link that opens one photo, for sharing and for coming back to. */
export function photoLink(id: string) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("photo", id);
  return url.href;
}

/**
 * Shares a link through the phone's share sheet, where there is one, or
 * copies it: whether it was shared, the viewer cancelled the sheet, or the
 * link was copied or could not be.
 */
export async function shareLink(
  url: string,
): Promise<"shared" | "cancelled" | "copied" | "failed"> {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse && navigator.share) {
    try {
      await navigator.share({ title: "Kiana", url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  return (await copyText(url)) ? "copied" : "failed";
}
