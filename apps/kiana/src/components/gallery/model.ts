export const SLIDE_DURATION = 10_000;
export const TRANSITION_DURATION = 1_600;

export const frames = ["fill", "backdrop", "mat"] as const;

export type Frame = (typeof frames)[number];
export type Transition = "fade" | "float" | "settle";

const frameTransitions: Record<Frame, Transition> = {
  fill: "fade",
  backdrop: "float",
  mat: "settle",
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function transitionFor(frame: Frame): Transition {
  return frameTransitions[frame];
}

export function formatPhotoDate(date: string | null) {
  if (!date) return "";
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return dateFormatter
    .format(new Date(Date.UTC(year, month - 1, day)))
    .toUpperCase();
}
