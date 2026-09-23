import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { cx } from "../../lib/class-names";

const SPEED = 28; // pixels per second
const GAP = 48;

/**
 * Text that scrolls when it does not fit, like an old player's display, and
 * sits still when it does. Hovering pauses it; reduced motion truncates.
 */
export function Marquee({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;
    const measure = () =>
      setOverflow(
        text.scrollWidth > box.clientWidth + 1 ? text.scrollWidth : 0,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(text);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cx(
        "group/marquee overflow-hidden whitespace-nowrap",
        overflow > 0 &&
          "[mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-24px),transparent)]",
        className,
      )}
      ref={boxRef}
    >
      <div
        className={cx(
          "inline-flex",
          overflow > 0 &&
            "animate-marquee group-hover/marquee:[animation-play-state:paused] motion-reduce:animate-none",
        )}
        style={
          overflow > 0
            ? ({
                "--marquee-duration": `${(overflow + GAP) / SPEED}s`,
              } as CSSProperties)
            : undefined
        }
      >
        <span className="inline-flex items-baseline" ref={textRef}>
          {children}
        </span>
        {overflow > 0 ? (
          <span
            aria-hidden="true"
            className="inline-flex items-baseline"
            style={{ paddingLeft: GAP }}
          >
            {children}
          </span>
        ) : null}
      </div>
    </div>
  );
}
