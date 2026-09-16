/**
 * Body tracking maths: weight trend, hydration, intake and sleep.
 *
 * Two rules run through all of it. Averages divide by the days that actually
 * have data, never by the width of the window — an empty day is missing, not a
 * zero. And a window that contains nothing returns null rather than 0, so the
 * UI can say "no data" instead of showing a confident, false number.
 */

export interface DatedValue {
  date: string;
  value: number;
}

export function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** The last `days` days ending at `today`, oldest first; null where nothing was logged. */
export function seriesFor(entries: DatedValue[], today: string, days: number): (number | null)[] {
  const byDate = new Map(entries.map((e) => [e.date, e.value]));
  const out: (number | null)[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const v = byDate.get(shiftDate(today, -i));
    out.push(v === undefined ? null : v);
  }
  return out;
}

/**
 * Gaps filled with the last reading, trimmed to start at the first one.
 *
 * A day you did not weigh yourself is not a day you weighed zero. Plotting a
 * missing day as 0 draws a cliff to the floor that never happened, which is
 * exactly what a weight chart must never do.
 */
export function carryForward(values: (number | null)[]): number[] {
  const out: number[] = [];
  let last: number | null = null;
  for (const v of values) {
    if (v !== null) last = v;
    if (last !== null) out.push(last);
  }
  return out;
}

/** Mean of the days that have data. Null when the window is empty. */
export function averageOf(values: (number | null)[]): number | null {
  const real = values.filter((v): v is number => v !== null && isFinite(v));
  if (!real.length) return null;
  return real.reduce((a, b) => a + b, 0) / real.length;
}

export interface WeightTrend {
  latest: number | null;
  latestDate: string | null;
  /** Change from the first to the last reading in the window. */
  change: number | null;
  /** Smoothed change: mean of the last third vs mean of the first third. */
  trend: number | null;
  toTarget: number | null;
}

/**
 * Weight moves a kilo either way with water and food, so a raw first-to-last
 * difference over-reads. `trend` compares the averages of each end of the
 * window instead, which is what actually tells you the direction.
 */
export function weightTrend(
  entries: DatedValue[],
  today: string,
  days = 30,
  targetKg?: number,
): WeightTrend {
  const window = entries
    .filter((e) => e.date <= today && e.date > shiftDate(today, -days))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!window.length) {
    return { latest: null, latestDate: null, change: null, trend: null, toTarget: null };
  }

  const last = window[window.length - 1];
  const change = window.length > 1 ? last.value - window[0].value : null;

  let trend: number | null = null;
  if (window.length >= 4) {
    const third = Math.max(1, Math.floor(window.length / 3));
    const early = averageOf(window.slice(0, third).map((e) => e.value));
    const late = averageOf(window.slice(-third).map((e) => e.value));
    if (early !== null && late !== null) trend = late - early;
  }

  return {
    latest: last.value,
    latestDate: last.date,
    change,
    trend,
    toTarget: targetKg ? last.value - targetKg : null,
  };
}

/** Progress toward a target, capped at 1. Null when no target is set. */
export function towardTarget(value: number, target?: number): number | null {
  if (!target || target <= 0) return null;
  return Math.min(1, Math.max(0, value / target));
}

export interface StreakOfDays {
  /** Consecutive days ending today (or yesterday, while today is open) that hit the target. */
  current: number;
  /** Days in the window that hit it. */
  hits: number;
  days: number;
}

export function targetStreak(
  entries: DatedValue[],
  today: string,
  target: number | undefined,
  days = 30,
): StreakOfDays {
  if (!target || target <= 0) return { current: 0, hits: 0, days };
  const byDate = new Map(entries.map((e) => [e.date, e.value]));
  const hit = (key: string) => (byDate.get(key) ?? 0) >= target;

  let hits = 0;
  for (let i = 0; i < days; i++) if (hit(shiftDate(today, -i))) hits++;

  let cursor = hit(today) ? today : shiftDate(today, -1);
  let current = 0;
  while (hit(cursor)) {
    current++;
    cursor = shiftDate(cursor, -1);
    if (current > 3650) break;
  }
  return { current, hits, days };
}

/** Hours between two "HH:MM" clock times, crossing midnight when it has to. */
export function hoursBetween(from: string, to: string): number | null {
  const parse = (s: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h + min / 60;
  };
  const a = parse(from);
  const b = parse(to);
  if (a === null || b === null) return null;
  let hrs = b - a;
  if (hrs <= 0) hrs += 24;
  return Math.round(hrs * 10) / 10;
}
