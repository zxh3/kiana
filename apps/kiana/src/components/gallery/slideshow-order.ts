import type { Order } from "./model";

export function shuffledIndexes(
  length: number,
  random: () => number = Math.random,
  avoidFirst?: number,
) {
  const order = Array.from({ length }, (_, index) => index);

  for (let index = order.length - 1; index > 0; index -= 1) {
    const value = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
    const swapIndex = Math.floor(value * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }

  if (order.length > 1 && order[0] === avoidFirst) {
    const swapIndex = order.findIndex((index) => index !== avoidFirst);
    [order[0], order[swapIndex]] = [order[swapIndex], order[0]];
  }

  return order;
}

/**
 * The assets to play after `current`, covering every other member once.
 * Shuffled queues never start with `current`; chronological queues continue
 * from it and wrap around to the oldest member.
 */
export function buildQueue(
  members: ReadonlyArray<number>,
  order: Order,
  current: number | undefined,
  random: () => number = Math.random,
) {
  if (order === "chronological") {
    const position = current === undefined ? -1 : members.indexOf(current);
    const rotated = [
      ...members.slice(position + 1),
      ...members.slice(0, position + 1),
    ];
    return rotated.filter((index) => index !== current);
  }

  const others = members.filter((index) => index !== current);
  return shuffledIndexes(others.length, random).map((index) => others[index]);
}

/**
 * The member next to `current` in date order, wrapping around at either end.
 * An asset outside the collection steps to the collection's first or last.
 */
export function neighborMember(
  members: ReadonlyArray<number>,
  current: number,
  direction: 1 | -1,
) {
  if (members.length === 0) return undefined;
  const position = members.indexOf(current);
  if (position === -1) return direction === 1 ? members[0] : members.at(-1);
  return members[(position + direction + members.length) % members.length];
}
