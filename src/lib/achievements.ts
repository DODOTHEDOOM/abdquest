/**
 * Badges and challenges, both derived from what actually happened.
 *
 * Nothing here is stored. A badge is earned when the state says it is earned,
 * and a challenge is done when the underlying thing was done — there is no
 * "claim" button, no separate ledger, and therefore no way for the two to drift
 * apart or to award the same thing twice. The old app kept parallel lists of
 * claimed achievements and completed challenges, which is exactly where that
 * class of bug lives.
 *
 * Challenges award no XP of their own: the habit, session or prayer behind them
 * already did. A challenge is a focus for the day, not a second currency.
 */

import { isPerfectDay, PRAYERS, type AppState } from "../state/schema";
import { previousBest, type Exercise } from "./training";
import { daysOfWeek } from "./weeklyReview";
import { weekStartOf } from "./training";

export type Tier = "bronze" | "silver" | "gold";

export interface Badge {
  id: string;
  name: string;
  detail: string;
  icon: string;
  tier: Tier;
  earned: boolean;
  /** Where you are against the requirement. */
  have: number;
  need: number;
}

function shift(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** Total days on record where every required habit was done. */
export function perfectDayCount(state: AppState): number {
  return Object.keys(state.done).filter((d) => isPerfectDay(state, d)).length;
}

/** Total days where all five prayers were recorded. */
export function fullPrayerDayCount(state: AppState): number {
  return Object.values(state.prayers.done).filter((day) => PRAYERS.every((p) => day[p.id])).length;
}

/** Days with at least one session — not sessions, so a big day counts once. */
export function trainingDayCount(state: AppState): number {
  return new Set(state.sessions.map((s) => s.date)).size;
}

/** Records that genuinely beat something, so a first-ever entry is not a "PR". */
export function realPrCount(library: Exercise[]): number {
  return library.filter((ex) => ex.pr.date && previousBest(ex) > 0).length;
}

function badge(
  id: string,
  name: string,
  detail: string,
  icon: string,
  tier: Tier,
  have: number,
  need: number,
): Badge {
  return { id, name, detail, icon, tier, earned: have >= need, have: Math.min(have, need), need };
}

export function badgesFor(state: AppState, library: Exercise[] = []): Badge[] {
  const out: Badge[] = [];
  const best = state.streak.best;
  const perfect = perfectDayCount(state);
  const trainDays = trainingDayCount(state);

  out.push(
    badge("streak7", "Full week", "A seven-day streak", "🔥", "bronze", best, 7),
    badge("streak30", "Full month", "A thirty-day streak", "🔥", "silver", best, 30),
    badge("streak100", "Hundred days", "A hundred-day streak", "🔥", "gold", best, 100),
    badge("perfect1", "First clean sheet", "Every habit, one day", "✅", "bronze", perfect, 1),
    badge("perfect25", "Twenty-five clean", "Every habit, 25 days", "✅", "silver", perfect, 25),
    badge("perfect100", "A hundred clean", "Every habit, 100 days", "✅", "gold", perfect, 100),
    badge("train1", "First session", "One training day logged", "🏋️", "bronze", trainDays, 1),
    badge("train50", "Fifty sessions", "Fifty training days", "🏋️", "silver", trainDays, 50),
    badge("train200", "Two hundred", "Two hundred training days", "🏋️", "gold", trainDays, 200),
  );

  const prs = realPrCount(library);
  out.push(
    badge("pr1", "New ground", "Beat a personal record", "🏆", "bronze", prs, 1),
    badge("pr10", "Ten records", "Ten records broken", "🏆", "silver", prs, 10),
  );

  if (state.modules.prayers) {
    const full = fullPrayerDayCount(state);
    out.push(
      badge("pray1", "Five for five", "All five prayers in a day", "🕌", "bronze", full, 1),
      badge("pray30", "Thirty days", "All five on thirty days", "🕌", "silver", full, 30),
      badge("pray100", "A hundred days", "All five on a hundred days", "🕌", "gold", full, 100),
    );
    const cleared =
      Object.keys(state.prayers.debt).length > 0 &&
      Object.values(state.prayers.debt).every((n) => n <= 0);
    out.push(
      badge(
        "debt0",
        "Debt cleared",
        "Every missed prayer repaid",
        "📿",
        "gold",
        cleared ? 1 : 0,
        1,
      ),
    );
  }

  return out;
}

/** Earned first, then whichever unearned badge you are closest to finishing. */
export function sortBadges(badges: Badge[]): Badge[] {
  return [...badges].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.earned) return 0;
    return b.have / b.need - a.have / a.need;
  });
}

// ── Challenges ──────────────────────────────────────────────────────────────

export interface Challenge {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  have: number;
  need: number;
}

/**
 * Today's focus list. Only challenges that are actually measurable for this
 * person appear — no water target means no hydration challenge.
 */
export function dailyChallenges(state: AppState, today: string): Challenge[] {
  const out: Challenge[] = [];

  const required = state.habits.filter((h) => !h.bonus);
  if (required.length) {
    const done = required.filter((h) => state.done[today]?.[h.id]).length;
    out.push({
      id: "habits",
      label: "Clear every habit",
      detail: `${done} of ${required.length} done`,
      done: done >= required.length,
      have: done,
      need: required.length,
    });
  }

  if (state.modules.prayers) {
    const day = state.prayers.done[today] ?? {};
    const done = PRAYERS.filter((p) => day[p.id]).length;
    out.push({
      id: "prayers",
      label: "All five prayers",
      detail: `${done} of ${PRAYERS.length} prayed`,
      done: done === PRAYERS.length,
      have: done,
      need: PRAYERS.length,
    });
  }

  const trained = state.sessions.some((s) => s.date === today);
  out.push({
    id: "train",
    label: "Move today",
    detail: trained ? "Session logged" : "Nothing logged yet",
    done: trained,
    have: trained ? 1 : 0,
    need: 1,
  });

  if (state.profile.waterTargetMl) {
    const ml = state.water.find((w) => w.date === today)?.ml ?? 0;
    out.push({
      id: "water",
      label: "Hit your water target",
      detail: `${(ml / 1000).toFixed(1)} of ${(state.profile.waterTargetMl / 1000).toFixed(1)} L`,
      done: ml >= state.profile.waterTargetMl,
      have: ml,
      need: state.profile.waterTargetMl,
    });
  }

  return out;
}

/** This week's focus list, measured over the days that have happened. */
export function weeklyChallenges(state: AppState, today: string): Challenge[] {
  const days = daysOfWeek(weekStartOf(today), today);
  const out: Challenge[] = [];

  if (state.habits.length) {
    const perfect = days.filter((d) => isPerfectDay(state, d)).length;
    out.push({
      id: "w_perfect",
      label: "Five clean days",
      detail: `${perfect} so far this week`,
      done: perfect >= 5,
      have: perfect,
      need: 5,
    });
  }

  const trainDays = new Set(state.sessions.filter((s) => days.includes(s.date)).map((s) => s.date))
    .size;
  out.push({
    id: "w_train",
    label: "Four training days",
    detail: `${trainDays} so far this week`,
    done: trainDays >= 4,
    have: trainDays,
    need: 4,
  });

  if (state.modules.prayers) {
    const full = days.filter((d) => {
      const day = state.prayers.done[d];
      return !!day && PRAYERS.every((p) => day[p.id]);
    }).length;
    out.push({
      id: "w_prayers",
      label: "All five, five days",
      detail: `${full} complete days this week`,
      done: full >= 5,
      have: full,
      need: 5,
    });
  }

  const nights = days.filter((d) => (state.health[d]?.sleepHrs ?? 0) > 0);
  if (nights.length) {
    const need = state.profile.sleepNeedHrs || 8;
    const good = nights.filter((d) => (state.health[d]?.sleepHrs ?? 0) >= need - 0.5).length;
    out.push({
      id: "w_sleep",
      label: `Four nights near ${need}h`,
      detail: `${good} of ${nights.length} nights recorded`,
      done: good >= 4,
      have: good,
      need: 4,
    });
  }

  return out;
}

/** Days in a row with at least one session, for the training card. */
export function trainingStreak(state: AppState, today: string): number {
  const dates = new Set(state.sessions.map((s) => s.date));
  let cursor = dates.has(today) ? today : shift(today, -1);
  let n = 0;
  while (dates.has(cursor)) {
    n++;
    cursor = shift(cursor, -1);
    if (n > 3650) break;
  }
  return n;
}
