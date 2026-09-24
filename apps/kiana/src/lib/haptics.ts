/**
 * Light taps from the phone's vibration motor, for controls that stand in
 * for physical ones, such as the music player's click wheel.
 *
 * Android browsers have the Vibration API, so `tap()` can tick from any
 * handler, even for each click of a turning wheel. Safari on iOS never has
 * had it. Instead it taps when its native switch control
 * (`<input type="checkbox" switch>`, Safari 17.4) is toggled by a real
 * touch; toggling one from script stopped tapping in iOS 26.5. So on
 * iPhones a tap can only answer a tap: `HapticTap` puts an invisible label
 * for a hidden switch over a button, and the finger's own touch toggles it.
 * Both are undocumented or best-effort, and silently do nothing elsewhere.
 */

/** How long an Android tap lasts, in milliseconds: a tick, not a buzz. */
const VIBRATE_FOR = 8;
/** The shortest gap between taps, so a fast turn does not blur into a buzz. */
const MIN_GAP = 30;

/** Whether a tap at `now` comes long enough after the last one. */
export function tapAllowed(last: number | null, now: number, gap = MIN_GAP) {
  return last === null || now - last >= gap;
}

/**
 * iPhones and iPads, including iPads that describe themselves as a Mac,
 * which only give themselves away by their touch screen.
 */
export function isIosDevice({
  maxTouchPoints,
  platform,
  userAgent,
}: Pick<Navigator, "maxTouchPoints" | "platform" | "userAgent">) {
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

let lastTap: number | null = null;

/**
 * Taps once where the Vibration API exists (Android). Call it from a handler
 * for something the viewer did, like `cue()`; browsers ignore vibration
 * without a gesture.
 */
export function tap() {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  const now = performance.now();
  if (!tapAllowed(lastTap, now)) return;
  lastTap = now;
  try {
    navigator.vibrate(VIBRATE_FOR);
  } catch {
    // A tap is a nicety; a failure must never break the interface.
  }
}
