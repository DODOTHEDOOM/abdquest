/**
 * Typed boundary around the verbatim Google Health port.
 *
 * Everything the app touches goes through here, so `legacyGoogleHealth.ts` can
 * stay exactly as it was on the day it worked. This file adds promises, types
 * and the mapping into v3 shapes — it adds no new API behaviour.
 */

import type { DailyHealth, HourHR, SleepStages } from "../lib/metrics/types";
import { activityById, type Session } from "../lib/training";
import {
  fbConnect,
  fbEnsureToken,
  fbExportCode,
  fbFetchDay,
  fbGet,
  fbHandleRedirect,
  fbImportCode,
  fbIsStandalone,
  fbRedirectUri,
  fbSet,
  ghCatalog,
  ghTypesCached,
} from "./legacyGoogleHealth";

/** One workout as the API reported it. */
export interface RawExercise {
  key?: string;
  name?: string;
  dur?: number;
  dist?: number;
  cal?: number;
  hr?: number;
  start?: string;
  startDay?: string;
  info?: Record<string, unknown> | null;
}

/** A day as `fbFetchDay` returns it — every field optional, nothing guaranteed. */
export interface RawDay {
  steps?: number;
  sleepHrs?: number;
  sleepStart?: string;
  sleepEnd?: string;
  sleepStages?: Record<string, number> | null;
  sleepSeq?: [string, number][] | null;
  rhr?: number;
  hrv?: number;
  resp?: number;
  spo2?: number;
  vo2max?: number;
  calOut?: number;
  calIn?: number;
  azm?: number;
  hrSeries?: (HourHR | null)[];
  hrAvg?: number;
  hrMin?: number;
  hrMax?: number;
  stepsHr?: number[];
  exercises?: RawExercise[];
  /** Per-metric "ok"/"empty"/error notes, for the diagnostics panel. */
  diag?: Record<string, string>;
  /** True when at least one metric came back with something. */
  any?: boolean;
}

// ── Connection ──────────────────────────────────────────────────────────────

export function isConnected(): boolean {
  return !!fbGet();
}

export function redirectUri(): string {
  return fbRedirectUri();
}

export function isStandalone(): boolean {
  return fbIsStandalone();
}

/** Sends the browser to Google's consent screen. Does not return. */
export function connect(clientId: string, clientSecret: string): void {
  fbConnect(clientId, clientSecret);
}

/**
 * The ONLY path that clears the stored connection, and it runs only when the
 * user taps Disconnect.
 */
export function disconnect(): void {
  fbSet(null);
}

export interface RedirectResult {
  handled: boolean;
  error: string | null;
}

/** Completes the OAuth round trip if the URL carries a `?code=`. */
export function handleRedirect(): Promise<RedirectResult> {
  return new Promise((resolve) => {
    fbHandleRedirect((ok: boolean, err: string | null) =>
      resolve({ handled: !!ok, error: err ?? null }),
    );
  });
}

/** A portable blob of the connection, for moving it to the home-screen app. */
export function exportCode(): string | null {
  return fbExportCode();
}

export function importCode(code: string): boolean {
  return fbImportCode(code);
}

// ── Fetching ────────────────────────────────────────────────────────────────

export function fetchDay(dateKey: string, full = false): Promise<RawDay | null> {
  return new Promise((resolve) => {
    fbFetchDay(dateKey, (r: RawDay | null) => resolve(r), full);
  });
}

/** Warms the data-type catalogue the metric fallbacks search through. */
/**
 * A usable access token, refreshing if needed — or null when the connection
 * can no longer be renewed.
 *
 * This is what separates "your watch has not synced yet" from "your sign-in has
 * expired". While a Google consent screen is in Testing, refresh tokens expire
 * after seven days, so this is a weekly event rather than a rare one, and
 * reporting it as missing data would send you to look at the wrong thing.
 */
export function ensureToken(): Promise<string | null> {
  return new Promise((resolve) => {
    fbEnsureToken((at: string | null) => resolve(at ?? null));
  });
}

export function primeCatalog(): void {
  if (ghTypesCached().length > 0) return;
  fbEnsureToken((at: string | null) => {
    if (at) ghCatalog(at, () => {});
  });
}

// ── Mapping into v3 ─────────────────────────────────────────────────────────

/**
 * Only fields the API actually returned. Absent stays absent, so merging this
 * over an existing day can never blank a reading that is already there.
 */
export function toDailyHealth(dateKey: string, raw: RawDay): DailyHealth {
  const d: DailyHealth = { date: dateKey };
  const put = <K extends keyof DailyHealth>(key: K, v: DailyHealth[K] | undefined) => {
    if (v !== undefined && v !== null && v !== 0) d[key] = v;
  };
  put("rhr", raw.rhr);
  put("hrv", raw.hrv);
  put("resp", raw.resp);
  put("spo2", raw.spo2);
  put("vo2max", raw.vo2max);
  put("hrAvg", raw.hrAvg);
  put("hrMin", raw.hrMin);
  put("hrMax", raw.hrMax);
  put("steps", raw.steps);
  put("azm", raw.azm);
  put("calOut", raw.calOut);
  put("sleepHrs", raw.sleepHrs);
  if (raw.sleepStart) d.sleepStart = raw.sleepStart;
  if (raw.sleepEnd) d.sleepEnd = raw.sleepEnd;
  // The API returns a deep/REM/light/awake breakdown. It used to be dropped here.
  const stages = cleanStages(raw.sleepStages);
  if (stages) d.sleepStages = stages;
  if (raw.hrSeries && raw.hrSeries.some(Boolean)) d.hrSeries = raw.hrSeries;
  return d;
}

/** Only the stages that came back with a sensible number of minutes. */
function cleanStages(raw: Record<string, number> | null | undefined): SleepStages | null {
  if (!raw) return null;
  const out: SleepStages = {};
  for (const key of ["deep", "rem", "light", "awake", "restless"] as const) {
    const v = raw[key];
    if (typeof v === "number" && isFinite(v) && v > 0) out[key] = Math.round(v);
  }
  return Object.keys(out).length ? out : null;
}

/** The old app's name-to-activity guess, kept so imports land where they used to. */
export function classifyActivity(name: string): string {
  const n = (name || "").toLowerCase();
  const hit = (...words: string[]) => words.some((w) => n.includes(w));
  if (hit("run", "jog")) return "run";
  if (hit("walk")) return "walk";
  if (hit("hike")) return "hike";
  if (hit("bike", "cycl", "spin")) return "cycle";
  if (hit("swim")) return "swim";
  if (hit("rope", "skip")) return "rope";
  if (hit("row")) return "row";
  if (hit("weight", "strength", "gym")) return "gym";
  if (hit("football", "soccer")) return "football";
  if (hit("basketball")) return "basketball";
  if (hit("tennis")) return "tennis";
  if (hit("padel")) return "padel";
  if (hit("box")) return "boxing";
  if (hit("martial", "karate", "judo")) return "martial";
  if (hit("climb")) return "climb";
  if (hit("yoga", "pilates", "stretch", "mobility")) return "yoga";
  return "other";
}

/**
 * Imported workouts as v3 sessions. Ids are stable (`gh_<date>_<key>`) so a
 * re-sync updates the same session instead of duplicating it, and anything you
 * logged by hand is left alone.
 */
export function sessionsFromDay(dateKey: string, raw: RawDay): Session[] {
  const out: Session[] = [];
  for (const ex of raw.exercises ?? []) {
    if (ex.startDay && ex.startDay !== dateKey) continue;
    const name = ex.name || "Workout";
    const activityId = classifyActivity(name);
    const kind = activityById(activityId).kind;
    out.push({
      id: `gh_${dateKey}_${ex.key ?? out.length}`,
      date: dateKey,
      activityId,
      // A watch cannot give us sets and reps, so a "gym" import is still an
      // effort session — it just carries the gym activity.
      kind: kind === "gym" ? "other" : kind,
      name,
      minutes: Math.round(ex.dur || 0),
      distanceKm: ex.dist || undefined,
      calories: ex.cal || undefined,
      avgHr: ex.hr || undefined,
      auto: true,
    });
  }
  return out;
}
