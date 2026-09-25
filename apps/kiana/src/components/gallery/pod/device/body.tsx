import type { CSSProperties, ReactNode } from "react";

import { cx } from "../../../../lib/class-names";
import { type Finish, finishStyles } from "./finishes";

const BODY_SHADOW =
  "inset 0 1px 0 var(--pod-rim), inset 0 -1px 1px rgb(0 0 0 / 0.18), 0 22px 56px -20px rgb(0 0 0 / 0.75)";

/** An aluminium body in the chosen finish, with its brushed grain. */
export function Body({
  children,
  finish,
  lifted,
  radius,
  style,
}: {
  children: ReactNode;
  finish: Finish;
  lifted: boolean;
  radius: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx(
        "relative isolate transition-[scale] duration-300 ease-soft",
        lifted && "scale-[1.03]",
      )}
      style={{
        ...(finishStyles[finish] as CSSProperties),
        backgroundImage: "var(--pod-body)",
        borderRadius: radius,
        boxShadow: BODY_SHADOW,
        ...style,
      }}
    >
      {/* The deeper shadow of a lifted player, faded in rather than
      animating the blur, which would repaint it on every frame. */}
      <div
        aria-hidden="true"
        className={cx(
          "pointer-events-none absolute inset-0 -z-20 rounded-[inherit] shadow-[0_34px_80px_-24px_rgb(0_0_0/.85)] transition-opacity duration-300 ease-soft",
          lifted ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-45 [background-image:repeating-linear-gradient(90deg,rgb(255_255_255/.07)_0_1px,transparent_1px_3px)]"
      />
      {children}
    </div>
  );
}
