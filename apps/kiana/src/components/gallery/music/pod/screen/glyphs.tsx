import type { BatteryState } from "../use-battery";

/**
 * The little pictures on the player's screen, drawn at their pixel sizes.
 * Their colours are the display's own, not the gallery's.
 */

export type PlayState = "playing" | "paused" | "none";

export function PlayStateGlyph({ state }: { state: PlayState }) {
  if (state === "none") return null;
  return (
    <svg
      aria-hidden="true"
      className="fill-[#2d7ae3]"
      height="8"
      viewBox="0 0 8 8"
      width="8"
    >
      {state === "playing" ? (
        <path d="M1 0.5 7.5 4 1 7.5Z" />
      ) : (
        <>
          <rect height="7" width="2.4" x="1" y="0.5" />
          <rect height="7" width="2.4" x="4.6" y="0.5" />
        </>
      )}
    </svg>
  );
}

/** Full and green when the level is unknown, red when nearly empty. */
export function BatteryGlyph({ battery }: { battery: BatteryState | null }) {
  const level = battery?.level ?? 1;
  const low = level <= 0.2;
  return (
    <svg aria-hidden="true" height="9" viewBox="0 0 19 9" width="19">
      <defs>
        <linearGradient id="pod-charge" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={low ? "#ff8a7a" : "#9be07a"} />
          <stop offset="0.5" stopColor={low ? "#e5412d" : "#5cbf3a"} />
          <stop offset="1" stopColor={low ? "#c93220" : "#48a82c"} />
        </linearGradient>
      </defs>
      <rect
        fill="#fff"
        height="8"
        rx="1.5"
        stroke="#7d7d7d"
        width="16"
        x="0.5"
        y="0.5"
      />
      <rect
        fill="url(#pod-charge)"
        height="6"
        rx="0.8"
        width={Math.max(1.5, 13 * level)}
        x="1.5"
        y="1.5"
      />
      <rect fill="#7d7d7d" height="3.5" rx="0.6" width="1.6" x="17" y="2.75" />
      {battery?.charging ? (
        <path
          d="M9.6 0.9 5.6 5h2.6l-1 3.1 4-4.1H8.6Z"
          fill="#fff"
          stroke="#555"
          strokeLinejoin="round"
          strokeWidth="0.6"
        />
      ) : null}
    </svg>
  );
}

/** The padlock the player shows while the hold switch is on. */
export function LockGlyph({ size = 9 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 8 9"
      width={(size * 8) / 9}
    >
      <path
        d="M2 4V2.8a2 2 0 0 1 4 0V4"
        fill="none"
        stroke="#e8870e"
        strokeWidth="1.2"
      />
      <rect fill="#f39a1f" height="5" rx="0.8" width="7" x="0.5" y="3.8" />
    </svg>
  );
}

/** Going back, in the title bar. */
export function BackGlyph() {
  return (
    <svg aria-hidden="true" height="10" viewBox="0 0 7 10" width="7">
      <path
        d="M5.5 1 1.5 5l4 4"
        fill="none"
        stroke="#4d4d4d"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

/** Marks the song that is playing in a list. */
export function SpeakerGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height="9"
      viewBox="0 0 11 9"
      width="11"
    >
      <path d="M0 3h2.2L5 0.6v7.8L2.2 6H0Z" />
      <path
        d="M6.8 2.3a3 3 0 0 1 0 4.4M8.6 0.9a5 5 0 0 1 0 7.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The mark beside someone signed in with Google: a tick in a badge, blue
 * on the screen and white on a highlighted row.
 */
export function VerifiedGlyph({ inverted = false }: { inverted?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="inline-block shrink-0 align-[-1px]"
      height="9"
      viewBox="0 0 9 9"
      width="9"
    >
      <circle cx="4.5" cy="4.5" fill={inverted ? "#fff" : "#2d7ae3"} r="4.5" />
      <path
        d="M2.4 4.6 3.9 6 6.6 3.1"
        fill="none"
        stroke={inverted ? "#2d7ae3" : "#fff"}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}
