import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  MUYU_PATH,
  type MuyuClientMessage,
  parseMuyuServerMessage,
  SEND_EVERY,
} from "../../../../lib/muyu";
import { useStoredState } from "../../use-stored-state";
import {
  initialMuyuState,
  muyuReducer,
  nextFrame,
  parseMerit,
  shownMerit,
} from "./muyu";
import { useLiveSocket } from "./use-live-socket";

/**
 * The connection to the electronic wooden fish, open only while `open`
 * (its screen is showing). Pats are sent together, at most every
 * `SEND_EVERY`, and show at once. The viewer's own merit is kept between
 * visits.
 */
export function useMuyu(open: boolean) {
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

  const pat = useCallback(() => {
    dispatch({ type: "pat" });
    setMine(mineRef.current + 1);
    mineRef.current += 1;
  }, [setMine]);

  return {
    status: state.status,
    here: state.here,
    pats: state.pats,
    merit: shownMerit(state),
    mine,
    pat,
  };
}

export type Muyu = ReturnType<typeof useMuyu>;
