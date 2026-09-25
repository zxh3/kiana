import type { Order } from "./model";
import { buildQueue, neighborMember } from "./slideshow-order";

/** How many shown assets "previous" can step back through. */
const HISTORY_LIMIT = 250;

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

/**
 * In date order, previous and next always mean the neighbouring photo by
 * date, wherever the slideshow got to (a jump from the library included).
 */
function step(
  playback: Playback,
  source: PlaybackSource,
  direction: 1 | -1,
): Playback {
  const current = currentIndex(playback);
  const target = neighborMember(source.members, current, direction);
  if (target === undefined || target === current) return playback;
  return {
    history: [target],
    position: 0,
    queue: buildQueue(source.members, "chronological", target),
    previous: current,
    slide: playback.slide + 1,
  };
}

export function advance(playback: Playback, source: PlaybackSource): Playback {
  if (source.order === "chronological") return step(playback, source, 1);
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
  return source.order === "chronological"
    ? source.members.length > 1
    : playback.position > 0;
}

/** Shuffle steps back through what was shown; date order steps back a date. */
export function retreat(playback: Playback, source: PlaybackSource): Playback {
  if (source.order === "chronological") return step(playback, source, -1);
  if (playback.position === 0) return playback;
  return moveTo(
    playback,
    playback.history,
    playback.position - 1,
    playback.queue,
  );
}

/**
 * Shows `index` next. In shuffle, previous returns to what was on screen; in
 * date order, previous and next continue from `index` by date.
 */
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
 * to the new collection. Otherwise the slideshow moves to `resumeAt` (where
 * date order last left this collection) when that is a member, or starts
 * the collection afresh.
 */
export function retarget(
  playback: Playback,
  source: PlaybackSource,
  resumeAt?: number,
): Playback {
  const current = currentIndex(playback);
  if (source.members.includes(current)) {
    return {
      ...playback,
      history: [current],
      position: 0,
      queue: buildQueue(source.members, source.order, current, source.random),
    };
  }

  if (resumeAt !== undefined && source.members.includes(resumeAt)) {
    return {
      history: [resumeAt],
      position: 0,
      queue: buildQueue(source.members, source.order, resumeAt, source.random),
      previous: current,
      slide: playback.slide + 1,
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
