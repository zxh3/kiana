export const SLIDE_DURATION = 10_000;
export const TRANSITION_DURATION = 1_600;

export const frames = ["fill", "backdrop", "mat"] as const;
export type Frame = (typeof frames)[number];
export type Transition = "fade" | "float" | "settle";

export const frameLabels: Record<Frame, string> = {
  fill: "Fill",
  backdrop: "Backdrop",
  mat: "Mat",
};

export const durations = [5_000, 10_000, 20_000, 60_000] as const;
export type Duration = (typeof durations)[number];

export const orders = ["shuffle", "chronological"] as const;
export type Order = (typeof orders)[number];

export const orderLabels: Record<Order, string> = {
  shuffle: "Shuffle",
  chronological: "By date",
};

const frameTransitions: Record<Frame, Transition> = {
  fill: "fade",
  backdrop: "float",
  mat: "settle",
};

export function transitionFor(frame: Frame): Transition {
  return frameTransitions[frame];
}

export function formatDurationLabel(duration: number) {
  return duration >= 60_000 ? `${duration / 60_000}m` : `${duration / 1_000}s`;
}

const longDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dayMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  timeZone: "UTC",
});

const relativeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "always",
});

function utcDate(date: string) {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** "15 October 2024", or an empty string for undated assets. */
export function formatPhotoDate(date: string | null) {
  return date ? longDateFormatter.format(utcDate(date)) : "";
}

/** "15 October", for a YYYY-MM-DD or MM-DD key. */
export function formatDayMonth(date: string) {
  const full = date.length === 5 ? `2024-${date}` : date;
  return dayMonthFormatter.format(utcDate(full));
}

export function formatWeekday(date: string) {
  return weekdayFormatter.format(utcDate(date));
}

export function formatMonthName(month: number) {
  return monthFormatter.format(new Date(Date.UTC(2024, month - 1, 1)));
}

/** "1:33 PM" from a 24-hour HH:MM wall-clock time. */
export function formatClockTime(time: string) {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const suffix = hours < 12 ? "AM" : "PM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** "0:14" or "1:02:05" for a video duration. */
export function formatMediaDuration(durationMs: number) {
  const total = Math.max(0, Math.round(durationMs / 1_000));
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** "Today", "Yesterday", "12 days ago", "3 months ago", "2 years ago". */
export function formatAgo(date: string, today: string) {
  const then = utcDate(date);
  const now = utcDate(today);
  const days = Math.round((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 31) return relativeFormatter.format(-days, "day");

  let months =
    (now.getUTCFullYear() - then.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - then.getUTCMonth());
  if (now.getUTCDate() < then.getUTCDate()) months -= 1;
  if (months < 12)
    return relativeFormatter.format(-Math.max(1, months), "month");
  return relativeFormatter.format(-Math.floor(months / 12), "year");
}

/** Today's local calendar date as YYYY-MM-DD. */
export function localDateKey(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
