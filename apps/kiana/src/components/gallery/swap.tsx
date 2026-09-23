import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import { cx } from "../../lib/class-names";
import { springs } from "../../lib/motion";

/**
 * Crossfades its children whenever `id` changes: the old one shrinks away as
 * the new one grows in. For icons and short labels that flip state, such as
 * play and pause.
 */
export function Swap({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id: string;
}) {
  return (
    <span className={cx("relative inline-grid place-items-center", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          className="grid place-items-center"
          exit={{ opacity: 0, scale: 0.55, filter: "blur(2px)" }}
          initial={{ opacity: 0, scale: 0.55, filter: "blur(2px)" }}
          key={id}
          transition={springs.snappy}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
