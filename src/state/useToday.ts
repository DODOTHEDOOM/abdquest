/**
 * The day the app is recording against.
 *
 * Two things this fixes over calling `ymd(new Date())` in each screen.
 *
 * The day resets at Fajr when prayers are switched on, matching the old app:
 * something logged at 2am belongs to the night you are still awake for. Without
 * prayers there is no Fajr to reset at, so it falls back to midnight.
 *
 * And it actually updates. Every screen used to compute the date once at render
 * and keep it forever, so an app left open across the rollover kept writing to
 * the previous day.
 */

import { useEffect, useState } from "react";
import { logicalDay } from "../lib/dates";
import { useStore } from "./store";

export function useToday(): string {
  const { state } = useStore();
  const fajr = state.modules.prayers ? (state.prayers.fajrTime ?? null) : null;

  const [day, setDay] = useState(() => logicalDay(new Date(), fajr));

  useEffect(() => {
    const check = () => setDay(logicalDay(new Date(), fajr));
    check();
    const t = setInterval(check, 60_000);
    // A phone that has been asleep does not run timers, so re-check on return.
    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fajr]);

  return day;
}
