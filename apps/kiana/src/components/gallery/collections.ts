import type { GalleryAsset } from "../../data/photos";
import { formatDayMonth, formatMonthName } from "./model";

/**
 * A collection is the set of assets the slideshow plays.
 * Years and months are encoded in the id so a choice can be persisted.
 */
export type CollectionId =
  | "all"
  | "on-this-day"
  | "favorites"
  | `year-${number}`
  | `month-${number}-${string}`;

export type Collection = {
  id: CollectionId;
  label: string;
  /** Extra context such as the matched day for "On this day". */
  detail?: string;
  /** Asset indexes in chronological order. */
  members: ReadonlyArray<number>;
};

type CollectionContext = {
  assets: ReadonlyArray<GalleryAsset>;
  chronological: ReadonlyArray<number>;
  favorites: ReadonlySet<string>;
  today: string;
};

/** "On this day" widens to the surrounding week when a date is sparse. */
const ON_THIS_DAY_MINIMUM = 6;
const ON_THIS_DAY_WINDOW = 3;

export function parseCollectionId(value: unknown): CollectionId | null {
  if (value === "all" || value === "on-this-day" || value === "favorites") {
    return value;
  }
  if (typeof value !== "string") return null;
  if (/^year-\d{4}$/.test(value)) return value as CollectionId;
  if (/^month-\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value as CollectionId;
  return null;
}

export function monthCollectionId(monthKey: string): CollectionId {
  return `month-${monthKey}` as CollectionId;
}

/** Asset indexes sorted oldest first; undated assets come last. */
export function chronologicalIndexes(assets: ReadonlyArray<GalleryAsset>) {
  const key = (asset: GalleryAsset) =>
    asset.date ? `${asset.date}T${asset.time ?? "00:00"}` : "~";
  return assets
    .map((asset, index) => ({ index, key: key(asset), id: asset.id }))
    .sort((left, right) =>
      left.key === right.key
        ? left.id.localeCompare(right.id)
        : left.key < right.key
          ? -1
          : 1,
    )
    .map(({ index }) => index);
}

const DAY_MS = 86_400_000;
const LEAP_YEAR_START = Date.UTC(2024, 0, 1);

/** Position of a month-day within a leap year, so 29 February has a slot. */
function dayOfYear(monthDay: string) {
  const [month = 1, day = 1] = monthDay.split("-").map(Number);
  return Math.round(
    (Date.UTC(2024, month - 1, day) - LEAP_YEAR_START) / DAY_MS,
  );
}

function circularDistance(left: number, right: number) {
  const distance = Math.abs(left - right);
  return Math.min(distance, 366 - distance);
}

export function onThisDay(
  assets: ReadonlyArray<GalleryAsset>,
  chronological: ReadonlyArray<number>,
  today: string,
) {
  const monthDay = today.slice(5, 10);
  const exact = chronological.filter(
    (index) => assets[index].date?.slice(5, 10) === monthDay,
  );
  if (exact.length >= ON_THIS_DAY_MINIMUM) {
    return { members: exact, widened: false };
  }

  const target = dayOfYear(monthDay);
  const nearby = chronological.filter((index) => {
    const date = assets[index].date;
    return (
      date !== null &&
      circularDistance(dayOfYear(date.slice(5, 10)), target) <=
        ON_THIS_DAY_WINDOW
    );
  });
  return { members: nearby, widened: true };
}

export function yearCounts(
  assets: ReadonlyArray<GalleryAsset>,
): Array<{ year: number; count: number }> {
  const counts = new Map<number, number>();
  for (const asset of assets) {
    if (!asset.date) continue;
    const year = Number(asset.date.slice(0, 4));
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts]
    .map(([year, count]) => ({ year, count }))
    .sort((left, right) => right.year - left.year);
}

export function resolveCollection(
  id: CollectionId,
  { assets, chronological, favorites, today }: CollectionContext,
): Collection {
  if (id === "on-this-day") {
    const { members, widened } = onThisDay(assets, chronological, today);
    const day = formatDayMonth(today);
    return {
      id,
      label: "On this day",
      detail: widened ? `The week around ${day}` : day,
      members,
    };
  }

  if (id === "favorites") {
    return {
      id,
      label: "Favorites",
      members: chronological.filter((index) => favorites.has(assets[index].id)),
    };
  }

  if (id.startsWith("year-")) {
    const year = id.slice(5);
    return {
      id,
      label: year,
      members: chronological.filter((index) =>
        assets[index].date?.startsWith(year),
      ),
    };
  }

  if (id.startsWith("month-")) {
    const monthKey = id.slice(6);
    const [year, month] = monthKey.split("-");
    return {
      id,
      label: `${formatMonthName(Number(month))} ${year}`,
      members: chronological.filter((index) =>
        assets[index].date?.startsWith(monthKey),
      ),
    };
  }

  return { id: "all", label: "Everything", members: chronological };
}
