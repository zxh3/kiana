import { useEffect, useState } from "react";

type BatteryManager = EventTarget & { level: number; charging: boolean };
type BatteryNavigator = Navigator & {
  getBattery?: () => Promise<BatteryManager>;
};

export type BatteryState = { level: number; charging: boolean };

/**
 * The viewer's own battery, for the status bar, where the browser shares it
 * (Chromium does; Safari and Firefox do not). Null means unknown.
 */
export function useBattery() {
  const [battery, setBattery] = useState<BatteryState | null>(null);

  useEffect(() => {
    const getBattery = (navigator as BatteryNavigator).getBattery;
    if (!getBattery) return;
    let manager: BatteryManager | null = null;
    let cancelled = false;
    const update = () => {
      if (manager) {
        setBattery({ level: manager.level, charging: manager.charging });
      }
    };
    getBattery
      .call(navigator)
      .then((found) => {
        if (cancelled) return;
        manager = found;
        update();
        found.addEventListener("levelchange", update);
        found.addEventListener("chargingchange", update);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      manager?.removeEventListener("levelchange", update);
      manager?.removeEventListener("chargingchange", update);
    };
  }, []);

  return battery;
}
