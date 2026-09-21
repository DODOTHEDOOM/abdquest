/**
 * Prayer times and prayer tracking.
 *
 * Times come from the Aladhan API (aladhan.com/prayer-times-api), which is the
 * same source the old app used. Everything here degrades to "no times yet"
 * rather than breaking: the tracker and the debt ledger work with no network,
 * no location and no permission granted, because missing a prayer time should
 * never stop you recording that you prayed.
 */

import { DEFAULT_ASR_SCHOOL, DEFAULT_PRAYER_METHOD, PRAYERS, type Place } from "../state/schema";

/**
 * Which calculation the times were worked out with. Part of the cache identity:
 * changing method or school changes the times, so cached entries computed under
 * the old setting must not be served afterwards.
 */
export interface PrayerCalc {
  method: number;
  school: 0 | 1;
}

export const DEFAULT_CALC: PrayerCalc = {
  method: DEFAULT_PRAYER_METHOD,
  school: DEFAULT_ASR_SCHOOL,
};

export interface PrayerTimes {
  /** prayer id -> "HH:MM" local. */
  times: Record<string, string>;
  date: string;
  /** Where these were computed for, so a moved location can invalidate them. */
  lat: number;
  lon: number;
  /** Sunrise, which ends the Fajr window. */
  sunrise?: string;
  /** e.g. "12 Rabi‘ al-awwal 1448", as the API formats it. */
  hijri?: string;
  method?: number;
  school?: 0 | 1;
}

const CACHE_KEY = "abdquest_prayer_times";

/** "05:12 (BST)" and "05:12" both come back from the API. */
export function cleanTime(raw: string): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(raw).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Minutes since local midnight, or null when unparseable. */
export function minutesOf(hm: string): number | null {
  const c = cleanTime(hm);
  if (!c) return null;
  const [h, m] = c.split(":").map(Number);
  return h * 60 + m;
}

export interface NextPrayer {
  id: string;
  name: string;
  at: string;
  /** Minutes from now until it starts. Negative means it has already begun. */
  inMinutes: number;
  /** True when this is tomorrow's Fajr rather than one still to come today. */
  tomorrow: boolean;
}

/**
 * The next prayer relative to `nowMinutes`. After Isha this rolls round to
 * tomorrow's Fajr, so the card never goes blank late at night.
 */
export function nextPrayer(times: Record<string, string>, nowMinutes: number): NextPrayer | null {
  const list = PRAYERS.map((p) => ({
    p,
    at: times[p.id],
    mins: minutesOf(times[p.id] ?? ""),
  })).filter(
    (x): x is { p: (typeof PRAYERS)[number]; at: string; mins: number } => x.mins !== null,
  );
  if (!list.length) return null;

  for (const x of list) {
    if (x.mins >= nowMinutes) {
      return {
        id: x.p.id,
        name: x.p.name,
        at: x.at,
        inMinutes: x.mins - nowMinutes,
        tomorrow: false,
      };
    }
  }
  const first = list[0];
  return {
    id: first.p.id,
    name: first.p.name,
    at: first.at,
    inMinutes: 24 * 60 - nowMinutes + first.mins,
    tomorrow: true,
  };
}

/**
 * Whether a prayer done at `nowMinutes` counts as within its window.
 *
 * The window runs from the prayer's own time until the next one starts, except
 * Fajr, which ends at sunrise rather than at Duhr. Outside that window it was
 * prayed late, which is worth recording honestly rather than flattening into a
 * single tick.
 *
 * Returns null when the times are not known, which is different from "late" and
 * must not be stored as one.
 */
export function isOnTime(
  prayerId: string,
  times: Record<string, string>,
  nowMinutes: number,
  sunrise?: string,
): boolean | null {
  const start = minutesOf(times[prayerId] ?? "");
  if (start === null) return null;

  const order: string[] = PRAYERS.map((p) => p.id);
  const idx = order.indexOf(prayerId);
  if (idx < 0) return null;

  let end: number | null = null;
  if (prayerId === "fajr") end = sunrise ? minutesOf(sunrise) : null;
  if (end === null) {
    const next = order[idx + 1];
    end = next ? minutesOf(times[next] ?? "") : 24 * 60;
  }
  if (end === null) end = 24 * 60;

  // Isha runs past midnight; treat anything after it on the same day as inside.
  if (end <= start) return nowMinutes >= start;
  return nowMinutes >= start && nowMinutes < end;
}

export function formatIn(minutes: number): string {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

// ── Streak ──────────────────────────────────────────────────────────────────

function shift(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/**
 * Consecutive days with all five prayers, ending today or yesterday — a day
 * still in progress must not break the run before it is over.
 */
export function prayerStreak(
  done: Record<string, Record<string, boolean>>,
  todayKey: string,
): number {
  const all = (key: string) => {
    const day = done[key];
    return !!day && PRAYERS.every((p) => day[p.id]);
  };
  let cursor = all(todayKey) ? todayKey : shift(todayKey, -1);
  let n = 0;
  while (all(cursor)) {
    n++;
    cursor = shift(cursor, -1);
    if (n > 3650) break;
  }
  return n;
}

/** How many of the last `days` days had all five, for the consistency bar. */
export function prayerConsistency(
  done: Record<string, Record<string, boolean>>,
  todayKey: string,
  days = 30,
): { full: number; partial: number; days: number } {
  let full = 0;
  let partial = 0;
  for (let i = 0; i < days; i++) {
    const day = done[shift(todayKey, -i)];
    if (!day) continue;
    const n = PRAYERS.filter((p) => day[p.id]).length;
    if (n === PRAYERS.length) full++;
    else if (n > 0) partial++;
  }
  return { full, partial, days };
}

// ── Times: fetch + cache ────────────────────────────────────────────────────

interface CacheShape {
  [key: string]: PrayerTimes;
}

function readCache(): CacheShape {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheShape) : {};
  } catch {
    return {};
  }
}

function writeCache(c: CacheShape): void {
  try {
    // Keep it small. A fortnight covers the backfill window and the next few days.
    const keys = Object.keys(c).sort().slice(-14);
    const trimmed: CacheShape = {};
    for (const k of keys) trimmed[k] = c[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    /* a full disk must not break prayer times */
  }
}

/** Near enough that cached times are still right (~1km), same calculation. */
function stillValid(a: PrayerTimes, place: Place, calc: PrayerCalc): boolean {
  if (Math.abs(a.lat - place.lat) >= 0.01 || Math.abs(a.lon - place.lon) >= 0.01) return false;
  // An entry from before these were recorded predates the setting; recompute.
  if (a.method !== calc.method || a.school !== calc.school) return false;
  return true;
}

export function cachedTimes(
  dateKey: string,
  place: Place,
  calc: PrayerCalc = DEFAULT_CALC,
): PrayerTimes | null {
  const hit = readCache()[dateKey];
  return hit && stillValid(hit, place, calc) ? hit : null;
}

/**
 * Times for a day, from cache when possible. Returns null rather than throwing
 * when offline — the caller shows the tracker without a countdown.
 */
export async function fetchPrayerTimes(
  dateKey: string,
  place: Place,
  calc: PrayerCalc = DEFAULT_CALC,
  fetchImpl: typeof fetch = fetch,
): Promise<PrayerTimes | null> {
  const hit = cachedTimes(dateKey, place, calc);
  if (hit) return hit;

  const [y, m, d] = dateKey.split("-");
  const url =
    `https://api.aladhan.com/v1/timings/${d}-${m}-${y}` +
    `?latitude=${place.lat}&longitude=${place.lon}` +
    `&method=${calc.method}&school=${calc.school}`;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        timings?: Record<string, string>;
        date?: {
          hijri?: { day?: string; month?: { en?: string }; year?: string };
        };
      };
    };
    const raw = json?.data?.timings;
    const h = json?.data?.date?.hijri;
    const hijri =
      h?.day && h?.month?.en && h?.year ? `${h.day} ${h.month.en} ${h.year}` : undefined;
    if (!raw) return null;
    const times: Record<string, string> = {};
    for (const p of PRAYERS) {
      const t = cleanTime(raw[p.apiKey] ?? "");
      if (t) times[p.id] = t;
    }
    if (!Object.keys(times).length) return null;
    const out: PrayerTimes = {
      times,
      date: dateKey,
      lat: place.lat,
      lon: place.lon,
      sunrise: cleanTime(raw.Sunrise ?? "") ?? undefined,
      hijri,
      method: calc.method,
      school: calc.school,
    };
    const cache = readCache();
    cache[dateKey] = out;
    writeCache(cache);
    return out;
  } catch {
    return null;
  }
}

/** Asks the device once. Resolves to null if refused or unavailable. */
export function locate(): Promise<Place | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Math.round(pos.coords.latitude * 10000) / 10000,
          lon: Math.round(pos.coords.longitude * 10000) / 10000,
        }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 24 * 60 * 60 * 1000 },
    );
  });
}
