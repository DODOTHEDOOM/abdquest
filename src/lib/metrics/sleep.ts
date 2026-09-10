/**
 * Sleep need, performance, debt and timing consistency.
 *
 * Method follows the mainstream sleep-science model used in consumer wearables
 * and the literature behind it (Van Dongen et al. 2003 on cumulative sleep debt;
 * Walker 2017 on regularity). Nothing proprietary:
 *
 *   need        = baseline need + a slice of outstanding debt + strain top-up
 *   performance = actual / need
 *   debt        = decayed rolling shortfall over the last 14 nights
 *   consistency = how tightly bed/wake times cluster (SD of clock minutes)
 */

import { clamp, clamp01, stats } from "./baseline";
import { DEFAULT_SLEEP_NEED_HRS, type DailyHealth, type Profile } from "./types";

export interface SleepResult {
  /** Hours actually slept. */
  actualHrs: number | null;
  /** Hours the model says were needed. */
  needHrs: number;
  /** 0..1 — actual vs need. */
  performance: number | null;
  /** Outstanding sleep debt in hours (0 when caught up). */
  debtHrs: number;
  /** 0..1 — how regular bed/wake times have been. */
  consistency: number | null;
  /** SD of bedtime in minutes, when computable. */
  bedtimeSdMins: number | null;
  label: string;
}

/** "HH:MM" → minutes since midnight, shifted so late-evening times sort sanely. */
function clockMins(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const mins = +m[1] * 60 + +m[2];
  // Treat 18:00–23:59 as "negative" so a 23:30 and a 00:30 bedtime are 60 min
  // apart rather than 23 hours apart.
  return mins >= 18 * 60 ? mins - 24 * 60 : mins;
}

export function sleepDebt(history: DailyHealth[], upTo: string, needBase: number): number {
  const nights = history
    .filter((d) => d.date < upTo && d.sleepHrs && d.sleepHrs > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);
  let debt = 0;
  for (const n of nights) {
    // Each night adds its shortfall, and yesterday's debt decays a little —
    // you do recover some of it just by living.
    debt = debt * 0.9 + Math.max(0, needBase - (n.sleepHrs as number));
  }
  return Math.round(clamp(debt, 0, 20) * 10) / 10;
}

export function sleepConsistency(
  history: DailyHealth[],
  upTo: string,
): { score: number | null; sdMins: number | null } {
  const mins = history
    .filter((d) => d.date <= upTo)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map((d) => clockMins(d.sleepStart))
    .filter((x): x is number => x != null);
  if (mins.length < 3) return { score: null, sdMins: null };
  const s = stats(mins);
  if (!s) return { score: null, sdMins: null };
  // 0 min SD → 1.0; 90 min SD or worse → 0.
  return { score: clamp01(1 - s.sd / 90), sdMins: Math.round(s.sd) };
}

export function sleep(
  today: DailyHealth,
  history: DailyHealth[],
  profile: Profile = {},
  strain0to21 = 0,
): SleepResult {
  const base = profile.sleepNeedHrs || DEFAULT_SLEEP_NEED_HRS;
  const debtHrs = sleepDebt(history, today.date, base);
  // Chip away at the debt rather than trying to clear it in one night: repay a
  // third, but never ask for more than an extra hour on top of baseline — a
  // 10-hour "need" is neither achievable nor motivating. Debt is surfaced
  // separately so it stays visible. A hard day adds up to ~45 min more.
  const debtTopUp = Math.min(1, debtHrs / 3);
  const needHrs = Math.round((base + debtTopUp + (strain0to21 / 21) * 0.75) * 10) / 10;
  const actualHrs = today.sleepHrs && today.sleepHrs > 0 ? today.sleepHrs : null;
  const performance = actualHrs != null ? clamp01(actualHrs / needHrs) : null;
  const { score: consistency, sdMins } = sleepConsistency(history, today.date);

  const pct = performance != null ? performance * 100 : null;
  const label =
    pct == null
      ? "No sleep data"
      : pct >= 95
        ? "Fully rested"
        : pct >= 85
          ? "Well rested"
          : pct >= 70
            ? "Slightly short"
            : "Under-slept";

  return { actualHrs, needHrs, performance, debtHrs, consistency, bedtimeSdMins: sdMins, label };
}
