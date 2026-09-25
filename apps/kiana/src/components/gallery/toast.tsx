import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { fades, springs } from "../../lib/motion";

export type ToastMessage = { id: number; text: string };

/** How long a toast stays before it fades. */
const TOAST_SHOWS_FOR = 2_200;

/** A short word at the top of the screen, one at a time, gone on its own. */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const id = useRef(0);
  const showToast = useCallback((text: string) => {
    id.current += 1;
    setToast({ id: id.current, text });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), TOAST_SHOWS_FOR);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  return { toast, showToast };
}

export function Toast({ message }: { message: ToastMessage | null }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-[max(80px,calc(env(safe-area-inset-top)+68px))] z-30 flex justify-center px-4"
    >
      <AnimatePresence mode="popLayout">
        {message ? (
          <motion.p
            animate={{ opacity: 1, y: 0, scale: 1, transition: springs.gentle }}
            className="glass rounded-full px-4 py-2.5 text-[11px] tracking-[.08em] text-paper"
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: fades.out }}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            key={message.id}
          >
            {message.text}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
