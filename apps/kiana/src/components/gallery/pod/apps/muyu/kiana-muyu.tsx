import { motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cx } from "../../../../../lib/class-names";
import { easeSoft } from "../../../../../lib/motion";
import { HapticTap } from "../../../haptic-tap";
import { muyuArt } from "./art";
import type { Muyu } from "./use-muyu";

/** How long Kiana keeps her eyes closed after the last pat. */
const HAPPY_FOR = 650;
/** "猫德 +1"s on screen at once; a fast patter's oldest make way. */
const MAX_FLOATS = 6;
/** Where the hand waits, above her head and out of sight. */
const HAND_AWAY = -48;

/**
 * 电子木鱼, the electronic wooden fish, with Kiana in place of the fish:
 * each tap on her, or press of the centre button, pats her head for one
 * more merit, 猫德 (cat merit, after the wooden fish's 功德). The hand
 * comes down, her head gives under it and her eyes close, and "猫德 +1"
 * floats up. Everyone's merit is one count, so it climbs as other people
 * pat too, shown on the left with the viewer's own and how many are here.
 *
 * Patting fast keeps the hand moving from wherever it is, rather than
 * starting over, and her eyes stay closed until the pats stop.
 */
export function KianaMuyu({ muyu, onPat }: { muyu: Muyu; onPat: () => void }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const still = useReducedMotion();
  const [floats, setFloats] = useState<Array<{ id: number; x: number }>>([]);
  const [happy, setHappy] = useState(false);
  const seenPats = useRef(muyu.pats);

  // Each new pat, from any control, plays once.
  useEffect(() => {
    if (muyu.pats === seenPats.current) return;
    seenPats.current = muyu.pats;
    const id = muyu.pats;
    setFloats((current) => [
      ...current.slice(-(MAX_FLOATS - 1)),
      { id, x: Math.round((Math.random() - 0.5) * 26) },
    ]);
    setHappy(true);
    const timer = window.setTimeout(() => setHappy(false), HAPPY_FOR);
    if (still) {
      animate("[data-hand]", { opacity: [null, 1, 0] }, { duration: 0.5 });
    } else {
      // Down onto her head, a little rub, and away; `null` starts from
      // wherever the last pat left it.
      animate(
        "[data-hand]",
        {
          y: [null, 0, -2, 0, HAND_AWAY],
          x: [null, 0, -3, 3, 0],
          opacity: [null, 1, 1, 1, 0],
        },
        { duration: 0.6, times: [0, 0.25, 0.45, 0.65, 1], ease: easeSoft },
      );
      // Her head gives as the hand lands, and springs back.
      animate(
        "[data-kiana]",
        { scaleY: [null, 0.9, 1.03, 1], scaleX: [null, 1.06, 0.99, 1] },
        { duration: 0.5, delay: 0.1, ease: easeSoft },
      );
    }
    return () => window.clearTimeout(timer);
  }, [animate, muyu.pats, still]);

  const { merit, mine, here, status } = muyu;
  return (
    <div
      className="relative h-full overflow-hidden bg-[radial-gradient(120%_95%_at_75%_100%,#fff8ec_0%,#f0e1c8_100%)]"
      ref={scope}
    >
      <div className="absolute top-2.5 left-3 leading-none" lang="zh">
        <p className="text-[9px] font-semibold tracking-[.3em] text-[#9a7b5a]">
          猫德
        </p>
        <p className="mt-1 text-[19px] font-bold text-[#3b2a1e] tabular-nums">
          {merit === null ? "…" : merit.toLocaleString()}
        </p>
      </div>
      <div
        className="absolute bottom-2 left-3 text-[9px] leading-[12px] text-[#9a7b5a]"
        lang="zh"
      >
        <p>
          我的{" "}
          <span className="font-semibold tabular-nums">
            {mine === null ? "…" : mine.toLocaleString()}
          </span>
        </p>
        <p>{status === "open" ? `${here} 人在摸` : "连接中…"}</p>
      </div>

      <button
        aria-label="Pat Kiana's head"
        className="absolute right-1.5 bottom-0 h-[110px] w-[104px] cursor-pointer outline-none"
        onClick={onPat}
        // For pointers; from the keyboard the centre button pats her.
        tabIndex={-1}
        type="button"
      >
        <div
          className="absolute inset-x-0 bottom-0 h-[100px] origin-bottom"
          data-kiana
        >
          {/* One frame or the other, swapped outright: her ears sit lower
          in the patted one, so the other must never show behind it. */}
          <img
            alt=""
            className={cx(
              "absolute inset-0 size-full object-contain object-bottom",
              happy && "invisible",
            )}
            draggable={false}
            src={muyuArt.kiana}
          />
          <img
            alt=""
            className={cx(
              "absolute inset-0 size-full object-contain object-bottom",
              !happy && "invisible",
            )}
            draggable={false}
            src={muyuArt.kianaPatted}
          />
        </div>
        <img
          alt=""
          className="pointer-events-none absolute top-[-25px] left-[36px] w-[32px] opacity-0"
          data-hand
          draggable={false}
          src={muyuArt.hand}
          style={{ transform: `translateY(${HAND_AWAY}px)` }}
        />
        {floats.map((float) => (
          <motion.span
            animate={
              still
                ? { opacity: [0, 1, 0] }
                : { opacity: [0, 1, 1, 0], y: [0, -10, -24, -32] }
            }
            className="pointer-events-none absolute top-[14px] left-1/2 text-[10px] font-bold whitespace-nowrap text-[#c0662b] [text-shadow:0_1px_0_rgb(255_255_255/.7)]"
            initial={{ opacity: 0, x: `calc(-50% + ${float.x}px)` }}
            key={float.id}
            lang="zh"
            onAnimationComplete={() =>
              setFloats((current) =>
                current.filter((each) => each.id !== float.id),
              )
            }
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            猫德 +1
          </motion.span>
        ))}
        <HapticTap />
      </button>
    </div>
  );
}
