import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";

import { changeHiddenPhotos } from "../../data/gallery";
import {
  applyHiddenChange,
  type HiddenChange,
  type HiddenIndex,
  type HiddenPhoto,
  indexHidden,
} from "../../lib/hidden-photos";

/**
 * The hidden photos on the admin page. A change shows at once and goes to
 * the Worker one at a time, in order, so each answer is the whole truth up
 * to that change; what shows is the latest answer with the changes still
 * on their way laid over it. A change that fails simply drops out.
 */
export function useHiddenPhotos(
  initial: ReadonlyArray<HiddenPhoto>,
  adminName: string,
) {
  const confirmed = useRef<HiddenIndex>(indexHidden(initial));
  const pending = useRef<Array<{ change: HiddenChange; at: number }>>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [hidden, setHidden] = useState(confirmed.current);
  const send = useServerFn(changeHiddenPhotos);

  const redraw = useCallback(() => {
    setHidden(
      pending.current.reduce(
        (shown, { change, at }) =>
          applyHiddenChange(shown, change, adminName, at),
        confirmed.current,
      ),
    );
  }, [adminName]);

  const change = useCallback(
    (wanted: HiddenChange) => {
      pending.current.push({ change: wanted, at: Date.now() });
      redraw();
      const sent = queue.current.then(async () => {
        try {
          confirmed.current = indexHidden(await send({ data: wanted }));
          return true;
        } catch (error) {
          console.error("Could not change the hidden photos", error);
          return false;
        } finally {
          pending.current.shift();
          redraw();
        }
      });
      queue.current = sent;
      return sent;
    },
    [redraw, send],
  );

  return { change, hidden };
}
