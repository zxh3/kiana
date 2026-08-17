export const SLIDE_DURATION = 10_000;
export const TRANSITION_DURATION = 1_600;

export const frames = ["fill", "backdrop", "mat"] as const;
export const transitions = ["fade", "push", "zoom", "blur", "drift"] as const;

export type Frame = (typeof frames)[number];
export type Transition = (typeof transitions)[number];
export type SlidePosition = { index: number; phase: number };

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function getSlidePosition(
  now: number,
  itemCount: number,
): SlidePosition {
  return {
    index: Math.floor(now / SLIDE_DURATION) % itemCount,
    phase: now % SLIDE_DURATION,
  };
}

export function transitionFor(index: number): Transition {
  const seed = Math.abs(Math.sin(index * 127.1) * 43_758.5453) % 1;
  return transitions[
    Math.floor(seed * transitions.length) % transitions.length
  ];
}

export function formatPhotoDate(date: string) {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return dateFormatter
    .format(new Date(Date.UTC(year, month - 1, day)))
    .toUpperCase();
}
