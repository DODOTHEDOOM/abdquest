/**
 * The weekly review.
 *
 * Rebuilt from the old app's `genRC`, which had a bug that made it useless:
 * every rate divided by 7, so on a Tuesday the best possible score was 2/7 and
 * the week was always graded F until Sunday. A week in progress is now measured
 * against the days that have actually happened.
 *
 * The second rule is the one the metrics engine uses: a component with nothing
 * to measure is dropped and the rest are re-weighted, so the score is always
 * built from real data. No water target set means hydration is not part of your
 * score — it does not silently count as zero.
 */

import { weekStartOf } from "./training";
import type { AppState } from "../state/schema";
import { isPerfectDay, PRAYERS } from "../state/schema";

export interface ReviewPart {
  key: string;
  label: string;
  /** Days that met the mark. */
  hit: number;
  /** Days it was possible to meet it. */
  of: number;
  weight: number;
  detail: string;
}

export interface WeeklyReview {
  weekStart: string;
  /** Days of this week that have happened — 7 for a finished week. */
  daysElapsed: number;
  complete: boolean;
  parts: ReviewPart[];
  /** 0..100, or null when there was nothing to measure at all. */
  score: number | null;
  label: string;
  /** Share of the intended weighting that had data behind it. */
  coverage: number;
}

function shift(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** The dates of a week that have actually happened, Monday first. */
export function daysOfWeek(weekStart: string, today: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = shift(weekStart, i);
    if (d > today) break;
    out.push(d);
  }
  return out;
}

function labelFor(score: number): string {
  if (score >= 85) return "Outstanding week";
  if (score >= 70) return "Strong week";
  if (score >= 55) return "Solid week";
  if (score >= 40) return "Patchy week";
  if (score >= 20) return "Slipping";
  return "Rough week";
}

/** Sessions a week that counts as hitting the training mark. */
export const TRAINING_TARGET = 4;

/**
 * How far back to look for any training at all before scoring it.
 *
 * Training is only part of your score if you actually train. Someone who has
 * never logged a session would otherwise carry a permanent zero for it — the
 * same "counts as zero" trap the water and food targets avoid. Someone who
 * trains and had a blank week does score zero for it, which is the truth.
 */
const TRAINING_LOOKBACK_DAYS = 56;

export function weeklyReview(state: AppState, today: string, weekStart?: string): WeeklyReview {
  const start = weekStart ?? weekStartOf(today);
  const days = daysOfWeek(start, today);
  const daysElapsed = days.length;
  const complete = daysElapsed === 7 && shift(start, 6) < today;

  const parts: ReviewPart[] = [];

  // ── Habits ────────────────────────────────────────────────────────────────
  if (state.habits.length && daysElapsed) {
    const hit = days.filter((d) => isPerfectDay(state, d)).length;
    parts.push({
      key: "habits",
      label: "Habits",
      hit,
      of: daysElapsed,
      weight: 0.3,
      detail: `${hit} of ${daysElapsed} day${daysElapsed === 1 ? "" : "s"} complete`,
    });
  }

  // ── Prayers ───────────────────────────────────────────────────────────────
  if (state.modules.prayers && daysElapsed) {
    const hit = days.filter((d) => {
      const day = state.prayers.done[d];
      return !!day && PRAYERS.every((p) => day[p.id]);
    }).length;
    parts.push({
      key: "prayers",
      label: "Prayers",
      hit,
      of: daysElapsed,
      weight: 0.2,
      detail: `${hit} of ${daysElapsed} day${daysElapsed === 1 ? "" : "s"} all five`,
    });
  }

  // ── Training ──────────────────────────────────────────────────────────────
  const trainsAtAll = state.sessions.some(
    (s) => s.date > shift(start, -TRAINING_LOOKBACK_DAYS) && s.date <= today,
  );
  if (trainsAtAll) {
    const trained = new Set(state.sessions.filter((s) => days.includes(s.date)).map((s) => s.date))
      .size;
    // Pro-rated: four sessions a week is the mark, so a Wednesday review asks
    // for the share of four that the week so far deserves.
    const of = Math.max(1, Math.round((TRAINING_TARGET * daysElapsed) / 7));
    parts.push({
      key: "training",
      label: "Training",
      hit: Math.min(trained, of),
      of,
      weight: 0.25,
      detail: `${trained} session day${trained === 1 ? "" : "s"}`,
    });
  }

  // ── Sleep ─────────────────────────────────────────────────────────────────
  {
    const need = state.profile.sleepNeedHrs || 8;
    const nights = days.filter((d) => (state.health[d]?.sleepHrs ?? 0) > 0);
    if (nights.length) {
      const hit = nights.filter((d) => (state.health[d]?.sleepHrs ?? 0) >= need - 0.5).length;
      parts.push({
        key: "sleep",
        label: "Sleep",
        hit,
        of: nights.length,
        weight: 0.15,
        detail: `${hit} of ${nights.length} night${nights.length === 1 ? "" : "s"} near ${need}h`,
      });
    }
  }

  // ── Water ─────────────────────────────────────────────────────────────────
  if (state.profile.waterTargetMl) {
    const target = state.profile.waterTargetMl;
    const logged = days.filter((d) => state.water.some((w) => w.date === d));
    if (logged.length) {
      const hit = logged.filter(
        (d) => (state.water.find((w) => w.date === d)?.ml ?? 0) >= target,
      ).length;
      parts.push({
        key: "water",
        label: "Water",
        hit,
        of: logged.length,
        weight: 0.05,
        detail: `${hit} of ${logged.length} day${logged.length === 1 ? "" : "s"} on target`,
      });
    }
  }

  // ── Food ──────────────────────────────────────────────────────────────────
  if (state.profile.kcalTarget) {
    const target = state.profile.kcalTarget;
    const logged = days.filter((d) => state.calories.some((c) => c.date === d));
    if (logged.length) {
      const hit = logged.filter(
        (d) => (state.calories.find((c) => c.date === d)?.kcal ?? 0) <= target,
      ).length;
      parts.push({
        key: "food",
        label: "Food",
        hit,
        of: logged.length,
        weight: 0.05,
        detail: `${hit} of ${logged.length} day${logged.length === 1 ? "" : "s"} at or under`,
      });
    }
  }

  let weighted = 0;
  let coverage = 0;
  for (const p of parts) {
    if (!p.of) continue;
    weighted += Math.min(1, p.hit / p.of) * p.weight;
    coverage += p.weight;
  }

  const score = coverage > 0 ? Math.round((weighted / coverage) * 100) : null;

  return {
    weekStart: start,
    daysElapsed,
    complete,
    parts,
    score,
    label: score === null ? "Nothing tracked yet" : labelFor(score),
    coverage,
  };
}

/** The last `count` weeks, most recent first, for the history list. */
export function recentWeeks(state: AppState, today: string, count = 8): WeeklyReview[] {
  const out: WeeklyReview[] = [];
  let start = weekStartOf(today);
  for (let i = 0; i < count; i++) {
    const r = weeklyReview(state, today, start);
    // Stop once the weeks are entirely empty rather than padding out blanks.
    if (i > 0 && r.score === null) break;
    out.push(r);
    start = shift(start, -7);
  }
  return out;
}
