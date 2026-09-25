import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  MUYU_PATH,
  type MuyuClientMessage,
  parseMuyuServerMessage,
  SEND_EVERY,
} from "../../../../../lib/muyu";
import { useStoredState } from "../../../use-stored-state";
import { useLiveSocket } from "../use-live-socket";
import {
  initialMuyuState,
  muyuReducer,
  nextFrame,
  parseMerit,
  shownMerit,
  shownMine,
} from "./muyu";

/**
 * The connection to the electronic wooden fish, open only while `open`
 * (its screen is showing). Pats are sent together, at most every
 * `SEND_EVERY`, and show at once. A guest's own merit is kept in this
 * browser between visits; signed in (`account`), the room keeps it for
 * their account, the same on every device.
 */
export function useMuyu(open: boolean, account: string | null) {
  const [mine, setMine] = useStoredState("kiana.muyu-mine", parseMerit);
  const [state, dispatch] = useReducer(muyuReducer, initialMuyuState);
  const latest = useRef(state);
  latest.current = state;
  const mineRef = useRef(mine);
  mineRef.current = mine;

  const send: (message: MuyuClientMessage) => boolean = useLiveSocket({
    onMessage: (data) => {
      const message = parseMuyuServerMessage(data);
      if (message) dispatch({ type: "received", message });
    },
    onOpen: () => undefined,
    onStatus: (status) => dispatch({ type: status }),
    account,
    open,
    path: MUYU_PATH,
  });

  // Waiting pats go out a moment after the first, together, and again
  // after each frame while more wait.
  const nextSeq =
    state.queued > 0 && state.status === "open" ? state.seq : null;
  useEffect(() => {
    if (nextSeq === null) return;
    const timer = window.setTimeout(() => {
      const frame = nextFrame(latest.current);
      if (frame && send({ type: "knock", ...frame })) {
        dispatch({ type: "sent", ...frame });
      }
    }, SEND_EVERY);
    return () => window.clearTimeout(timer);
  }, [nextSeq, send]);

  const signedIn = account !== null;
  const pat = useCallback(() => {
    dispatch({ type: "pat" });
    if (signedIn) return;
    setMine(mineRef.current + 1);
    mineRef.current += 1;
  }, [setMine, signedIn]);

  return {
    status: state.status,
    here: state.here,
    pats: state.pats,
    merit: shownMerit(state),
    /** Null while a signed-in viewer's merit is on its way from the room. */
    mine: signedIn ? shownMine(state) : mine,
    pat,
  };
}

export type Muyu = ReturnType<typeof useMuyu>;
