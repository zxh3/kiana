import { cx } from "../../lib/class-names";

export function AudioControl({
  muted,
  mat,
  onToggle,
}: {
  muted: boolean;
  mat: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      aria-pressed={!muted}
      className={cx(
        "absolute top-[max(18px,env(safe-area-inset-top))] right-5 z-10 grid size-10 cursor-pointer place-items-center rounded-full border backdrop-blur-xl transition-[color,background-color,border-color,opacity] duration-200 focus-visible:outline-none focus-visible:ring-1 max-sm:right-4",
        mat
          ? "border-[rgba(23,18,15,.12)] bg-[rgba(246,240,230,.66)] text-[rgba(23,18,15,.62)] hover:text-[#17120f] focus-visible:ring-[#17120f]"
          : "border-[rgba(246,240,230,.1)] bg-[rgba(23,18,15,.46)] text-[rgba(246,240,230,.62)] hover:text-[#f6f0e6] focus-visible:ring-[#f6f0e6]",
      )}
      onClick={onToggle}
      title={muted ? "Sound off" : "Sound on"}
      type="button"
    >
      {muted ? (
        <svg
          aria-hidden="true"
          fill="none"
          height="16"
          viewBox="0 0 16 16"
          width="16"
        >
          <path d="M2.5 6v4h2.3L8 12.5v-9L4.8 6H2.5Z" fill="currentColor" />
          <path
            d="m10.5 6 3 4m0-4-3 4"
            stroke="currentColor"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          fill="none"
          height="16"
          viewBox="0 0 16 16"
          width="16"
        >
          <path d="M2.5 6v4h2.3L8 12.5v-9L4.8 6H2.5Z" fill="currentColor" />
          <path
            d="M10.25 5.25a4 4 0 0 1 0 5.5M11.8 3.7a6 6 0 0 1 0 8.6"
            stroke="currentColor"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
