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

export function upcomingIndexes(
  order: ReadonlyArray<number>,
  nextOrder: ReadonlyArray<number>,
  cursor: number,
  count: number,
) {
  return [...order.slice(cursor + 1), ...nextOrder].slice(0, count);
}
