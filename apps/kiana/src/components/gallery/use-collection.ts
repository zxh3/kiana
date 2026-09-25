import { useCallback, useEffect, useMemo, useState } from "react";

import type { GalleryAsset } from "../../data/photos";
import {
  type CollectionId,
  chronologicalIndexes,
  resolveCollection,
  yearCounts,
} from "./collections";

const NO_FAVORITES: ReadonlySet<string> = new Set();

/**
 * What the slideshow plays: the collection the viewer chose, kept between
 * visits, or Everything while that one is empty, with everything the
 * collection menu counts. A shared link to a photo the saved collection
 * does not hold plays within Everything for the visit instead.
 */
export function useCollection({
  assets,
  favorites,
  favoritesSettled,
  initialPhotoId,
  savedId,
  saveId,
  today,
}: {
  assets: ReadonlyArray<GalleryAsset>;
  favorites: ReadonlySet<string>;
  /** Favorites are known for sure, rather than still on their way. */
  favoritesSettled: boolean;
  initialPhotoId?: string;
  savedId: CollectionId;
  saveId: (id: CollectionId) => void;
  today: string;
}) {
  const chronological = useMemo(() => chronologicalIndexes(assets), [assets]);
  const years = useMemo(() => yearCounts(assets), [assets]);
  const [linkedIndex] = useState(() =>
    initialPhotoId ? assets.findIndex(({ id }) => id === initialPhotoId) : -1,
  );

  // A shared link plays within Everything for this visit when the saved
  // collection does not contain it, without overwriting the saved choice.
  const [linkOverride, setLinkOverride] = useState<CollectionId | null>(() => {
    if (linkedIndex < 0) return null;
    const saved = resolveCollection(savedId, {
      assets,
      chronological,
      favorites,
      today,
    });
    return saved.members.includes(linkedIndex) ? null : "all";
  });
  const collectionId = linkOverride ?? savedId;
  const setCollectionId = useCallback(
    (id: CollectionId) => {
      setLinkOverride(null);
      saveId(id);
    },
    [saveId],
  );

  // Only the collections that depend on favorites or today recompute.
  const favoritesKey = collectionId === "favorites" ? favorites : NO_FAVORITES;
  const todayKey = collectionId === "on-this-day" ? today : "";
  const chosen = useMemo(
    () =>
      resolveCollection(collectionId, {
        assets,
        chronological,
        favorites: favoritesKey,
        today: todayKey,
      }),
    [assets, chronological, collectionId, favoritesKey, todayKey],
  );
  const everything = useMemo(
    () =>
      resolveCollection("all", {
        assets,
        chronological,
        favorites: NO_FAVORITES,
        today: "",
      }),
    [assets, chronological],
  );
  const collection = chosen.members.length > 0 ? chosen : everything;
  // An empty collection gives way to Everything, but Favorites only once
  // they are known: they arrive a moment after the page, from the account.
  useEffect(() => {
    if (chosen.members.length > 0 || collectionId === "all") return;
    if (collectionId === "favorites" && !favoritesSettled) return;
    setCollectionId("all");
  }, [chosen.members.length, collectionId, favoritesSettled, setCollectionId]);

  const onThisDay = useMemo(
    () =>
      resolveCollection("on-this-day", {
        assets,
        chronological,
        favorites: NO_FAVORITES,
        today,
      }),
    [assets, chronological, today],
  );
  const favoriteCount = useMemo(
    () =>
      assets.reduce((count, { id }) => count + Number(favorites.has(id)), 0),
    [assets, favorites],
  );

  return {
    chronological,
    collection,
    favoriteCount,
    linkedIndex,
    onThisDay,
    setCollectionId,
    years,
  };
}
