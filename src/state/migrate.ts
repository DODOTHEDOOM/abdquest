/**
 * Bring an `abdquest_v2` blob across to v3.
 *
 * Read-only on the source: the v2 blob is parsed and never written back or
 * removed. If this produces something wrong, the original app still opens with
 * all of its data.
 *
 * Anything unrecognised is skipped rather than guessed at, and every field is
 * defended against the shape drifting over the old app's many versions.
 */

import type { DailyHealth, HourHR } from "../lib/metrics/types";
import { activityById, type GymSet, type Session } from "../lib/training";
import { emptyState, type AppState, type Habit, type Note } from "./schema";

/** The old colourways, mapped onto the closest new one. */
const THEME_MAP: Record<string, string> = {
  dark: "midnight",
  light: "daylight",
  ocean: "lagoon",
  emerald: "aurora",
  royal: "midnight",
  crimson: "ember",
  aurum: "aurum",
};

function num(v: unknown): number | undefined {
  return typeof v === "number" && isFinite(v) ? v : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
const isDate = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k);

/** v2 kept habits, "life quests" and bonus quests in separate lists. */
function habitsFrom(v2: Record<string, unknown>): Habit[] {
  const out: Habit[] = [];
  const take = (list: unknown, bonus = false) => {
    for (const raw of arr(list)) {
      const q = obj(raw);
      const id = str(q.id);
      const name = str(q.label) ?? str(q.name);
      if (!id || !name) continue;
      if (out.some((h) => h.id === id)) continue;
      out.push({
        id,
        name,
        detail: str(q.desc),
        icon: str(q.icon),
        ...(bonus ? { bonus: true } : {}),
      });
    }
  };
  take(v2.habits);
  take(v2.life);
  take(v2.bonus, true);
  return out;
}

/** v2 stored today in `done` and history in `log[]`. */
function doneFrom(v2: Record<string, unknown>): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {};
  for (const raw of arr(v2.log)) {
    const entry = obj(raw);
    const date = str(entry.date);
    if (!date || !isDate(date)) continue;
    const map: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(obj(entry.done))) if (v) map[k] = true;
    out[date] = map;
  }
  const lastDay = str(v2.lastDay);
  if (lastDay && isDate(lastDay)) {
    const map: Record<string, boolean> = { ...(out[lastDay] ?? {}) };
    for (const [k, v] of Object.entries(obj(v2.done))) if (v) map[k] = true;
    out[lastDay] = map;
  }
  return out;
}

function setsFrom(raw: unknown): GymSet[] {
  const out: GymSet[] = [];
  for (const s of arr(raw)) {
    const o = obj(s);
    const reps = num(o.reps) ?? 0;
    const weight = num(o.weight) ?? 0;
    if (reps <= 0 && weight <= 0) continue;
    out.push({ reps, weight });
  }
  return out;
}

/** v2 workoutSessions: date -> list of gym or cardio cards. */
function sessionsFrom(v2: Record<string, unknown>): Session[] {
  const out: Session[] = [];
  for (const [date, list] of Object.entries(obj(v2.workoutSessions))) {
    if (!isDate(date)) continue;
    for (const raw of arr(list)) {
      const s = obj(raw);
      const type = str(s.type) ?? "other";
      const id = str(s.id) ?? `mig_${date}_${out.length}`;
      if (type === "gym") {
        const sets = setsFrom(s.sets);
        if (!sets.length) continue;
        out.push({
          id,
          date,
          activityId: "gym",
          kind: "gym",
          exerciseId:
            str(s.exId) ??
            `ex_${(str(s.name) ?? "movement").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          name: str(s.name) ?? "Movement",
          metric: s.metric === "bodyweight" ? "bodyweight" : "weight",
          sets,
        });
      } else {
        // 'fbx' was the old catch-all for a watch-imported workout.
        const activityId = type === "fbx" ? "other" : type;
        const kind = activityById(activityId).kind;
        out.push({
          id,
          date,
          activityId,
          kind: kind === "gym" ? "other" : kind,
          name: str(s.name),
          minutes: Math.round(num(s.duration) ?? 0),
          distanceKm: num(s.distance),
          calories: num(s.cal),
          avgHr: num(s.hr),
          auto: s.auto === true,
        });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function hrSeriesFrom(raw: unknown): (HourHR | null)[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.map((h) => {
    const o = obj(h);
    const avg = num(o.avg);
    if (!avg) return null;
    return { avg, min: num(o.min) ?? avg, max: num(o.max) ?? avg };
  });
  return out.some(Boolean) ? out : undefined;
}

/** v2 spread health across fbDaily, stepLog and sleepLog. */
function healthFrom(v2: Record<string, unknown>, sessions: Session[]): Record<string, DailyHealth> {
  const out: Record<string, DailyHealth> = {};
  const ensure = (date: string): DailyHealth => (out[date] ??= { date });

  for (const [date, raw] of Object.entries(obj(v2.fbDaily))) {
    if (!isDate(date)) continue;
    const f = obj(raw);
    const d = ensure(date);
    d.rhr = num(f.rhr);
    d.hrv = num(f.hrv);
    d.resp = num(f.resp);
    d.spo2 = num(f.spo2);
    d.vo2max = num(f.vo2max);
    d.hrAvg = num(f.hrAvg);
    d.hrMin = num(f.hrMin);
    d.hrMax = num(f.hrMax);
    d.azm = num(f.azm);
    d.calOut = num(f.calOut);
    d.sleepStart = str(f.sleepStart) ?? null;
    d.sleepEnd = str(f.sleepEnd) ?? null;
    d.hrSeries = hrSeriesFrom(f.hrSeries);
  }

  for (const [date, steps] of Object.entries(obj(v2.stepLog))) {
    if (!isDate(date)) continue;
    const n = num(steps);
    if (n) ensure(date).steps = n;
  }

  for (const raw of arr(v2.sleepLog)) {
    const e = obj(raw);
    const date = str(e.date);
    const hrs = num(e.hrs);
    if (date && isDate(date) && hrs) ensure(date).sleepHrs = hrs;
  }

  // Minutes trained per day feed the activity rating behind VO2max.
  for (const s of sessions) {
    const d = ensure(s.date);
    d.workoutMins = (d.workoutMins ?? 0) + (s.kind === "gym" ? s.sets.length * 3 : s.minutes || 0);
  }

  return out;
}

function notesFrom(v2: Record<string, unknown>): Record<string, Note> {
  const out: Record<string, Note> = {};
  for (const [date, raw] of Object.entries(obj(v2.notes))) {
    if (!isDate(date)) continue;
    const n = obj(raw);
    const text = str(n.text);
    if (!text) continue;
    out[date] = { text, mood: str(n.mood) };
  }
  return out;
}

/** True when this looks like a v2 blob worth migrating. */
export function looksLikeV2(value: unknown): boolean {
  const v = obj(value);
  return ["xp", "streak", "done", "habits", "prayers"].every((k) => k in v);
}

export function migrateV2(value: unknown): AppState {
  const v2 = obj(value);
  const base = emptyState();

  const sessions = sessionsFrom(v2);
  const habits = habitsFrom(v2);

  const weight = arr(v2.wtLog)
    .map((raw) => {
      const e = obj(raw);
      return { date: str(e.date) ?? "", kg: num(e.wt) ?? 0 };
    })
    .filter((e) => isDate(e.date) && e.kg > 0);

  const calories = arr(v2.calLog)
    .map((raw) => {
      const e = obj(raw);
      return { date: str(e.date) ?? "", kcal: num(e.cal) ?? 0, protein: num(e.prot) };
    })
    .filter((e) => isDate(e.date) && e.kcal > 0);

  const water = arr(v2.waterLog)
    .map((raw) => {
      const e = obj(raw);
      return { date: str(e.date) ?? "", ml: num(e.ml) ?? 0 };
    })
    .filter((e) => isDate(e.date) && e.ml > 0);

  const latestWeight = weight.length ? weight[weight.length - 1].kg : num(v2.startWt);

  return {
    ...base,
    profile: {
      ...base.profile,
      weightKg: latestWeight,
    },
    // Their habits already exist, so there is nothing to set up.
    onboarded: habits.length > 0,
    themeId: THEME_MAP[str(v2.theme) ?? ""] ?? base.themeId,
    habits: habits.length ? habits : base.habits,
    done: doneFrom(v2),
    streak: {
      current: num(v2.streak) ?? 0,
      best: num(v2.bestStreak) ?? num(v2.streak) ?? 0,
      lastDay: str(v2.lastDay) ?? null,
    },
    xp: num(v2.xp) ?? 0,
    sessions,
    health: healthFrom(v2, sessions),
    weight,
    calories,
    water,
    notes: notesFrom(v2),
    migratedFrom: "v2",
  };
}
