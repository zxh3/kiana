import type { Order } from "./model";
import { buildQueue, previousMember } from "./slideshow-order";

/** How many shown assets "previous" can step back through. */
export const HISTORY_LIMIT = 250;

export type Playback = {
  /** Asset indexes in the order they were shown. */
  history: number[];
  /** Position of the visible asset within `history`. */
  position: number;
  /** Asset indexes that play after the end of `history`. */
  queue: number[];
  /** The asset that is transitioning out, if any. */
  previous: number | null;
  /** Increments whenever the visible asset changes. */
  slide: number;
};

export type PlaybackSource = {
  members: ReadonlyArray<number>;
  order: Order;
  random?: () => number;
};

export function currentIndex(playback: Playback) {
  return playback.history[playback.position];
}

export function createPlayback(
  { members, order, random }: PlaybackSource,
  initial?: number,
): Playback {
  if (initial !== undefined && members.includes(initial)) {
    return {
      history: [initial],
      position: 0,
      queue: buildQueue(members, order, initial, random),
      previous: null,
      slide: 0,
    };
  }

  const [first = 0, ...queue] = buildQueue(members, order, undefined, random);
  return { history: [first], position: 0, queue, previous: null, slide: 0 };
}

function moveTo(
  playback: Playback,
  history: number[],
  position: number,
  queue: number[],
): Playback {
  return {
    history,
    position,
    queue,
    previous: currentIndex(playback),
    slide: playback.slide + 1,
  };
}

export function advance(playback: Playback, source: PlaybackSource): Playback {
  if (playback.position < playback.history.length - 1) {
    return moveTo(
      playback,
      playback.history,
      playback.position + 1,
      playback.queue,
    );
  }

  const current = currentIndex(playback);
  const queue =
    playback.queue.length > 0
      ? playback.queue
      : buildQueue(source.members, source.order, current, source.random);
  const [next, ...rest] = queue;
  if (next === undefined || next === current) return playback;

  const history = [...playback.history, next].slice(-HISTORY_LIMIT);
  return moveTo(playback, history, history.length - 1, rest);
}

export function canRetreat(playback: Playback, source: PlaybackSource) {
  return (
    playback.position > 0 ||
    (source.order === "chronological" && source.members.length > 1)
  );
}

export function retreat(playback: Playback, source: PlaybackSource): Playback {
  if (playback.position > 0) {
    return moveTo(
      playback,
      playback.history,
      playback.position - 1,
      playback.queue,
    );
  }
  if (source.order !== "chronological") return playback;

  const before = previousMember(source.members, currentIndex(playback));
  if (before === undefined) return playback;
  const history = [before, ...playback.history].slice(0, HISTORY_LIMIT);
  return moveTo(playback, history, 0, playback.queue);
}

/** Shows `index` next, keeping the way back to what was on screen. */
export function jump(
  playback: Playback,
  source: PlaybackSource,
  index: number,
): Playback {
  if (index === currentIndex(playback)) return playback;
  const history = [
    ...playback.history.slice(0, playback.position + 1),
    index,
  ].slice(-HISTORY_LIMIT);
  return moveTo(
    playback,
    history,
    history.length - 1,
    buildQueue(source.members, source.order, index, source.random),
  );
}

/**
 * Adopts a new collection or order. The visible asset stays when it belongs
 * to the new collection; otherwise the slideshow moves to the new one.
 */
export function retarget(playback: Playback, source: PlaybackSource): Playback {
  const current = currentIndex(playback);
  if (source.members.includes(current)) {
    return {
      ...playback,
      history: [current],
      position: 0,
      queue: buildQueue(source.members, source.order, current, source.random),
    };
  }

  const [next, ...queue] = buildQueue(
    source.members,
    source.order,
    undefined,
    source.random,
  );
  if (next === undefined) return playback;
  return {
    history: [next],
    position: 0,
    queue,
    previous: current,
    slide: playback.slide + 1,
  };
}

export function upcoming(playback: Playback, count: number) {
  return [
    ...playback.history.slice(playback.position + 1),
    ...playback.queue,
  ].slice(0, count);
}
