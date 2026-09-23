import { useCallback, useEffect, useState } from "react";

export function useFullscreen() {
  const [active, setActive] = useState(() =>
    Boolean(document.fullscreenElement),
  );
  const supported = Boolean(document.fullscreenEnabled);

  useEffect(() => {
    const handleChange = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else if (document.fullscreenEnabled) {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, []);

  return { active, supported, toggle };
}
