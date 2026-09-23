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

/** The member that precedes `current` chronologically, wrapping around. */
export function previousMember(
  members: ReadonlyArray<number>,
  current: number,
) {
  if (members.length < 2) return undefined;
  const position = members.indexOf(current);
  if (position === -1) return members.at(-1);
  return members[(position - 1 + members.length) % members.length];
}
