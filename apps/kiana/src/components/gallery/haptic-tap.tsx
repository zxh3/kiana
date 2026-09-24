import { type MouseEvent, useSyncExternalStore } from "react";

import { isIosDevice } from "../../lib/haptics";

const subscribe = () => () => undefined;
const onIos = () => isIosDevice(navigator);

/** The switch's `switch` attribute, which React's input types do not know. */
const switchAttribute = { switch: "" } as Record<string, string>;

/**
 * Makes a tap on its parent button felt on iPhones. It lays an invisible
 * label over the parent, tied to a hidden native switch: the finger's touch
 * lands on the label, Safari forwards it to the switch as a real toggle, and
 * a toggled switch taps the motor. The click still reaches the parent's own
 * handlers once. The switch never sits under the finger, because WebKit
 * treats a touch that starts on it as handled and would cancel swipes. After
 * ios-haptics by tijnjh (MIT). Rendered only on iOS, after hydration; the
 * parent must be positioned.
 */
export function HapticTap() {
  const ios = useSyncExternalStore(subscribe, onIos, () => false);
  if (!ios) return null;
  return (
    <label
      aria-hidden="true"
      className="absolute inset-0 touch-manipulation [-webkit-tap-highlight-color:transparent]"
    >
      <input
        {...switchAttribute}
        className="invisible absolute m-0 size-px"
        // The label passes its click on to the switch; keep that second
        // click from reaching the parent's handlers too.
        onClick={(event: MouseEvent) => event.stopPropagation()}
        tabIndex={-1}
        type="checkbox"
      />
    </label>
  );
}
