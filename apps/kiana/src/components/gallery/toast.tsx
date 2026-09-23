import { AnimatePresence, motion } from "motion/react";

import { fades, springs } from "../../lib/motion";

export type ToastMessage = { id: number; text: string };

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
