import { useEffect, useState } from "react";

import { localDateKey } from "./model";

/** Today's date, rolling over at local midnight for a page left running. */
export function useToday() {
  const [today, setToday] = useState(localDateKey);

  useEffect(() => {
    let timeout: number;
    const scheduleNextDay = () => {
      const now = new Date();
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        5,
      );
      timeout = window.setTimeout(() => {
        setToday(localDateKey());
        scheduleNextDay();
      }, midnight.getTime() - now.getTime());
    };
    scheduleNextDay();
    return () => window.clearTimeout(timeout);
  }, []);

  return today;
}
