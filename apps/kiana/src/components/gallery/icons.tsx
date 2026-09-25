import type { ReactNode, SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Icon({
  size = 20,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 20 20"
      width={size}
      {...props}
    >
      {children}
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M6.75 4.9v10.2c0 .63.7 1.02 1.23.68l8.1-5.1a.8.8 0 0 0 0-1.36l-8.1-5.1a.8.8 0 0 0-1.23.68Z"
        fill="currentColor"
        stroke="none"
      />
    </Icon>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect
        fill="currentColor"
        height="11"
        rx="1.1"
        stroke="none"
        width="3.2"
        x="5.4"
        y="4.5"
      />
      <rect
        fill="currentColor"
        height="11"
        rx="1.1"
        stroke="none"
        width="3.2"
        x="11.4"
        y="4.5"
      />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12.25 4.75 7 10l5.25 5.25" strokeWidth={1.7} />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.75 4.75 13 10l-5.25 5.25" strokeWidth={1.7} />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 8.25 4 4 4-4" />
    </Icon>
  );
}

export function HeartIcon({
  filled = false,
  ...props
}: IconProps & { filled?: boolean }) {
  return (
    <Icon {...props}>
      <path
        d="M10 16.1c-.18 0-.36-.05-.52-.15C7.93 15 3.5 12 3.5 8.05 3.5 6.08 5.03 4.5 6.95 4.5c1.23 0 2.35.62 3.05 1.6.7-.98 1.82-1.6 3.05-1.6 1.92 0 3.45 1.58 3.45 3.55C16.5 12 12.07 15 10.52 15.95c-.16.1-.34.15-.52.15Z"
        fill={filled ? "currentColor" : "none"}
      />
    </Icon>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 3.25v9" />
      <path d="M6.9 6.1 10 3l3.1 3.1" />
      <path d="M7 8.75H6a1.75 1.75 0 0 0-1.75 1.75v4.25c0 .97.78 1.75 1.75 1.75h8c.97 0 1.75-.78 1.75-1.75V10.5c0-.97-.78-1.75-1.75-1.75h-1" />
    </Icon>
  );
}

export function SoundOnIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M3.5 8.1v3.8c0 .33.27.6.6.6h2.2L9.3 15V5L6.3 7.5H4.1a.6.6 0 0 0-.6.6Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M12.5 7.6a3.4 3.4 0 0 1 0 4.8" />
      <path d="M14.75 5.4a6.5 6.5 0 0 1 0 9.2" />
    </Icon>
  );
}

/** A pointer clicking, for the interface's own sounds. */
export function ClickIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M8.2 7.2v9.1l2.3-2.1 1.7 3.5 1.6-.8-1.7-3.4 3.1-.3Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M5.6 3.4 6.5 5M3.3 5.7 4.9 6.6M2.9 9h1.8M9 2.6v1.8" />
    </Icon>
  );
}

export function SoundOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M3.5 8.1v3.8c0 .33.27.6.6.6h2.2L9.3 15V5L6.3 7.5H4.1a.6.6 0 0 0-.6.6Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="m12.5 8 4 4m0-4-4 4" />
    </Icon>
  );
}

export function ExpandIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.25 8V4.25H8M12 4.25h3.75V8M15.75 12v3.75H12M8 15.75H4.25V12" />
    </Icon>
  );
}

export function CollapseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 4.25V8H4.25M15.75 8H12V4.25M12 15.75V12h3.75M4.25 12H8v3.75" />
    </Icon>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.75 6.5h6.5M14.75 6.5h1.5M3.75 13.5h1.5M9.75 13.5h6.5" />
      <circle cx="12.5" cy="6.5" r="1.9" />
      <circle cx="7.5" cy="13.5" r="1.9" />
    </Icon>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect height="5" rx="1.2" width="5" x="3.75" y="3.75" />
      <rect height="5" rx="1.2" width="5" x="11.25" y="3.75" />
      <rect height="5" rx="1.2" width="5" x="3.75" y="11.25" />
      <rect height="5" rx="1.2" width="5" x="11.25" y="11.25" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5.5 5.5 9 9m0-9-9 9" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 10.4 3.1 3.1L15 6.6" strokeWidth={1.7} />
    </Icon>
  );
}

export function LiveIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" fill="currentColor" r="1.9" stroke="none" />
      <circle cx="10" cy="10" r="4.3" strokeWidth={1.3} />
      <circle
        cx="10"
        cy="10"
        r="7"
        strokeDasharray="0.01 2.35"
        strokeWidth={1.6}
      />
    </Icon>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M7 5.6v8.8c0 .5.55.8.97.54l6.9-4.4a.64.64 0 0 0 0-1.08l-6.9-4.4A.64.64 0 0 0 7 5.6Z"
        fill="currentColor"
        stroke="none"
      />
    </Icon>
  );
}

export function StackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect height="9" rx="1.6" width="11" x="4.5" y="7" />
      <path d="M6.5 4.75h7" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect height="11.5" rx="2" width="13" x="3.5" y="5" />
      <path d="M3.5 8.75h13M7 3.25v3M13 3.25v3" />
    </Icon>
  );
}

export function KeyboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect height="9.5" rx="2" width="14.5" x="2.75" y="5.25" />
      <path
        d="M6 8.5h.01M8.67 8.5h.01M11.33 8.5h.01M14 8.5h.01M7 11.5h6"
        strokeWidth={1.6}
      />
    </Icon>
  );
}

export function MusicNoteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.5 14.5V5.2l8-1.7v9.3" />
      <circle cx="5.6" cy="14.6" fill="currentColor" r="1.9" stroke="none" />
      <circle cx="13.6" cy="12.9" fill="currentColor" r="1.9" stroke="none" />
    </Icon>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 5.25H5.75a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h7.5a1.5 1.5 0 0 0 1.5-1.5V12" />
      <path d="M11 4.25h4.75V9M15.5 4.5 9.5 10.5" />
    </Icon>
  );
}

/** Where each bar on the pocket player's screen rests while paused. */
const screenBarRest = [0.45, 0.85, 0.6];

/**
 * The pocket player itself, for the top bar now that it holds more than
 * music: its body, the screen, and the click wheel round its centre
 * button. Bars on the screen dance while music plays and rest while it is
 * paused; before any music the screen is empty, and they grow into it.
 */
export function PocketPlayerIcon({
  bars,
  playing,
  ...props
}: IconProps & {
  /** Music has started, so the screen shows its bars. */
  bars: boolean;
  playing: boolean;
}) {
  return (
    <Icon {...props}>
      <rect height="16.5" rx="2.75" width="10.5" x="4.75" y="1.75" />
      <rect
        fill="currentColor"
        height="5.25"
        opacity={0.22}
        rx="0.9"
        stroke="none"
        width="6.5"
        x="6.75"
        y="3.75"
      />
      {screenBarRest.map((rest, index) => (
        <rect
          className="origin-bottom animate-equalize transition-transform duration-300 [transform-box:fill-box] motion-reduce:animate-none"
          fill="currentColor"
          height="3.6"
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative bars
          key={index}
          rx="0.5"
          stroke="none"
          style={
            bars && playing
              ? {
                  animationDelay: `${-index * 0.27}s`,
                  animationDuration: `${0.8 + index * 0.19}s`,
                }
              : {
                  animation: "none",
                  transform: `scaleY(${bars ? rest : 0})`,
                }
          }
          width="1.2"
          x={7.75 + index * 1.65}
          y="4.65"
        />
      ))}
      <circle cx="10" cy="13.35" r="2.9" strokeWidth={1.35} />
      <circle cx="10" cy="13.35" fill="currentColor" r="0.95" stroke="none" />
    </Icon>
  );
}

const equalizerRest = [0.35, 0.6, 0.45, 0.3];

/** Four bars that dance while music plays and settle when it stops. */
export function EqualizerIcon({
  className,
  playing,
}: {
  className?: string;
  playing: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-4 w-4 items-end justify-center gap-[2px] ${className ?? ""}`}
    >
      {equalizerRest.map((rest, index) => (
        <span
          className="h-full w-[2.5px] origin-bottom animate-equalize rounded-full bg-current transition-transform duration-300 motion-reduce:animate-none"
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative bars
          key={index}
          style={
            playing
              ? {
                  animationDelay: `${-index * 0.23}s`,
                  animationDuration: `${0.85 + index * 0.17}s`,
                }
              : { animation: "none", transform: `scaleY(${rest})` }
          }
        />
      ))}
    </span>
  );
}

export function RepeatIcon({
  one = false,
  ...props
}: IconProps & { one?: boolean }) {
  return (
    <Icon {...props}>
      <path d="M4 9.5V8.25A2.25 2.25 0 0 1 6.25 6H15" />
      <path d="m13 3.75 2.25 2.25L13 8.25" />
      <path d="M16 10.5v1.25A2.25 2.25 0 0 1 13.75 14H5" />
      <path d="m7 16.25-2.25-2.25L7 11.75" />
      {one ? <path d="M9.4 9.1 10.4 8.5v3.4" strokeWidth={1.4} /> : null}
    </Icon>
  );
}

export function ShuffleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.75 6.25h1.9c1.1 0 2.13.54 2.76 1.44l3.18 4.62a3.35 3.35 0 0 0 2.76 1.44h1.9" />
      <path d="M3.75 13.75h1.9c1.1 0 2.13-.54 2.76-1.44l.4-.58M11.2 8.27l.39-.58a3.35 3.35 0 0 1 2.76-1.44h1.9" />
      <path d="m14.5 4.25 2 2-2 2M14.5 11.75l2 2-2 2" />
    </Icon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.25 10S5 4.75 10 4.75 17.75 10 17.75 10 15 15.25 10 15.25 2.25 10 2.25 10Z" />
      <circle cx="10" cy="10" r="2.4" />
    </Icon>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.1 4.95A7.6 7.6 0 0 1 10 4.75c5 0 7.75 5.25 7.75 5.25a13.5 13.5 0 0 1-2.2 2.85M5.6 6.1C3.4 7.55 2.25 10 2.25 10S5 15.25 10 15.25c1.45 0 2.7-.45 3.8-1.1" />
      <path d="M8.3 8.3a2.4 2.4 0 0 0 3.4 3.4" />
      <path d="m3.5 3.5 13 13" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2.75 4.25 4.9v4.45c0 3.6 2.4 6.5 5.75 7.9 3.35-1.4 5.75-4.3 5.75-7.9V4.9L10 2.75Z" />
      <path d="m7.6 10 1.7 1.7 3.1-3.3" />
    </Icon>
  );
}
