import { useId } from "react";

import { kianaArt, spinnerArt } from "./art";
import type { KianaFace, SpinnerLooks, SpinnerStyle } from "./spinner";

/** The steel ring the cap sits in, and Kiana on it, in the drawing's units. */
const CAP_RIM = 20;
const CAP_FACE = 36;

/** The ids one drawing's `<use>` copies point at. */
export function useArtIds() {
  const id = useId().replace(/[^\w-]/g, "");
  return { metal: `${id}-metal`, shape: `${id}-shape` };
}

/** The spinning body, for `<use>` to draw, and the cap's steel. */
export function SpinnerDefs({
  ids,
  spinner,
}: {
  ids: ReturnType<typeof useArtIds>;
  spinner: SpinnerStyle;
}) {
  return (
    <defs>
      <radialGradient cx="0.38" cy="0.32" id={ids.metal} r="0.75">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.5" stopColor="#d4d8de" />
        <stop offset="1" stopColor="#8d949d" />
      </radialGradient>
      <image
        height="92"
        href={spinnerArt[spinner]}
        id={ids.shape}
        width="92"
        x="4"
        y="4"
      />
    </defs>
  );
}

/**
 * The cap in the middle, which a finger holds still while the rest turns:
 * Kiana, in a steel ring, staying upright however fast it spins.
 */
export function SpinnerCap({
  face,
  ids,
}: {
  face: KianaFace;
  ids: ReturnType<typeof useArtIds>;
}) {
  return (
    <g>
      <circle
        cx="50"
        cy="50"
        fill={`url(#${ids.metal})`}
        r={CAP_RIM}
        stroke="rgb(0 0 0 / 0.3)"
        strokeWidth="0.6"
      />
      <image
        height={CAP_FACE}
        href={kianaArt[face]}
        width={CAP_FACE}
        x={50 - CAP_FACE / 2}
        y={50 - CAP_FACE / 2}
      />
    </g>
  );
}

/**
 * A small spinner for the top menu's preview of Apps, its body turning
 * slowly under Kiana, who stays upright as on the real one.
 */
export function SpinnerIcon({
  looks,
  size,
}: {
  looks: SpinnerLooks;
  size: number;
}) {
  const ids = useArtIds();
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 100 100" width={size}>
      <SpinnerDefs ids={ids} spinner={looks.spinner} />
      <g className="drop-shadow-[0_1.5px_1.5px_rgb(0_0_0/.35)]">
        <g className="origin-center animate-[spin_9s_linear_infinite] [transform-box:view-box] motion-reduce:animate-none">
          <use href={`#${ids.shape}`} />
        </g>
      </g>
      <SpinnerCap face={looks.face} ids={ids} />
    </svg>
  );
}
