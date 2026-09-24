/**
 * Light taps from the phone's vibration motor, for controls that stand in
 * for physical ones, such as the music player's click wheel.
 *
 * Android browsers have the Vibration API, so `tap()` can tick from any
 * handler, even for each click of a turning wheel. Safari on iOS never has
 * had it. Instead it taps when its native switch control
 * (`<input type="checkbox" switch>`, Safari 17.4) is toggled by a real
 * touch; toggling one from script stopped tapping in iOS 26.5. So on
 * iPhones a tap has to come from a finger on a switch:
 *
 * - For a press, `HapticTap` puts an invisible label for a hidden switch
 *   over a button, and the finger's own tap toggles it.
 * - For a drag, a switch under the finger can be moved so that its middle
 *   crosses the finger, which flips it as if the finger had slid its knob.
 *   The click wheel does this, and lends `tap()` the crossing with
 *   `setTouchSwitch` while a finger is on it.
 *
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
let crossSwitch: (() => void) | null = null;

/**
 * Lends `tap()` a way to tap on iPhones while a finger drags a switch:
 * `cross` moves the switch's middle to the finger's other side. Returns a
 * function that takes it back.
 */
export function setTouchSwitch(cross: () => void) {
  crossSwitch = cross;
  return () => {
    if (crossSwitch === cross) crossSwitch = null;
  };
}

/**
 * Taps once: through the Vibration API where it exists (Android), or on an
 * iPhone while a finger is on a switch lent with `setTouchSwitch`. Call it
 * from a handler for something the viewer did, like `cue()`; browsers
 * ignore vibration without a gesture.
 */
export function tap() {
  if (typeof navigator === "undefined") return;
  const vibrates = "vibrate" in navigator;
  if (!vibrates && !crossSwitch) return;
  const now = performance.now();
  if (!tapAllowed(lastTap, now)) return;
  lastTap = now;
  try {
    if (vibrates) navigator.vibrate(VIBRATE_FOR);
    else crossSwitch?.();
  } catch {
    // A tap is a nicety; a failure must never break the interface.
  }
}
