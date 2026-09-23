import { type CollectionId, parseCollectionId } from "./collections";
import {
  type Duration,
  durations,
  type Frame,
  frames,
  type Order,
  SLIDE_DURATION,
} from "./model";
import { useStoredState } from "./use-stored-state";

// The desktop wallpaper app writes "fill" to this key before the page loads.
const FRAME_KEY = "kiana.frame";
const DURATION_KEY = "kiana.duration";
const ORDER_KEY = "kiana.order";
const COLLECTION_KEY = "kiana.collection";
const AWAKE_KEY = "kiana.keep-awake";
const SOUNDS_KEY = "kiana.ui-sounds";

export function parseFrame(raw: string | null): Frame {
  const normalized = raw === "bleed" ? "fill" : raw;
  return frames.includes(normalized as Frame)
    ? (normalized as Frame)
    : "backdrop";
}

export function parseDuration(raw: string | null): Duration {
  const value = Number(raw);
  return durations.includes(value as Duration)
    ? (value as Duration)
    : SLIDE_DURATION;
}

export function parseOrder(raw: string | null): Order {
  return raw === "chronological" ? "chronological" : "shuffle";
}

export function parseStoredCollection(raw: string | null): CollectionId {
  return parseCollectionId(raw) ?? "all";
}

export function parseFlag(raw: string | null) {
  return raw === "true";
}

export function useGalleryPreferences() {
  const [frame, setFrame] = useStoredState(FRAME_KEY, parseFrame);
  const [duration, setDuration] = useStoredState(DURATION_KEY, parseDuration);
  const [order, setOrder] = useStoredState(ORDER_KEY, parseOrder);
  const [collectionId, setCollectionId] = useStoredState(
    COLLECTION_KEY,
    parseStoredCollection,
  );
  const [keepAwake, setKeepAwake] = useStoredState(AWAKE_KEY, parseFlag);
  const [uiSounds, setUiSounds] = useStoredState(SOUNDS_KEY, parseFlag);
  return {
    collectionId,
    keepAwake,
    uiSounds,
    duration,
    frame,
    order,
    setCollectionId,
    setDuration,
    setFrame,
    setKeepAwake,
    setUiSounds,
    setOrder,
  };
}
