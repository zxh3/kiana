import { useCallback, useEffect, useState } from "react";

import type { GalleryAsset } from "../../data/photos";
import { SLIDE_DURATION } from "./model";

export function useSlideshow(assets: ReadonlyArray<GalleryAsset>) {
  const [index, setIndex] = useState(0);
  const activeAsset = assets[index];
  const activeId = activeAsset?.id;
  const usesTimer = activeAsset?.type !== "video";

  const advance = useCallback(() => {
    setIndex((current) => (current + 1) % assets.length);
  }, [assets.length]);

  useEffect(() => {
    if (!usesTimer || !activeId) return;
    const timeout = window.setTimeout(advance, SLIDE_DURATION);
    return () => window.clearTimeout(timeout);
  }, [activeId, advance, usesTimer]);

  return {
    advance,
    index,
  };
}
