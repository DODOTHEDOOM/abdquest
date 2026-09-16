/**
 * The app store: one reducer, persisted to localStorage under the v3 key.
 *
 * Loading order: an existing v3 state, else migrate a v2 blob, else start
 * fresh. The v2 blob is only ever read.
 */

import { createContext, useContext, useEffect, useReducer, useState } from "react";
import type { DailyHealth } from "../lib/metrics/types";
import type { Session } from "../lib/training";
import { looksLikeV2, migrateV2 } from "./migrate";
import {
  emptyState,
  isPerfectDay,
  LEGACY_KEY,
  STORAGE_KEY,
  type AppState,
  PRAYERS,
  type Note,
  type Place,
  type Profile,
} from "./schema";

// ── XP ──────────────────────────────────────────────────────────────────────

export const XP_PER_HABIT = 20;
export const XP_PERFECT_DAY = 60;
export const XP_PER_SESSION = 40;
export const XP_PER_PRAYER = 15;
/** All five in one day, on top of the five individual awards. */
export const XP_ALL_PRAYERS = 40;
/** One prayer repaid from the debt ledger. */
export const XP_PER_DEBT_PRAYER = 10;

// ── Streak ──────────────────────────────────────────────────────────────────

function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Consecutive perfect days ending today — or ending yesterday, since a day
 * still in progress should not break a streak before midnight.
 */
export function computeStreak(state: AppState, todayKey: string): number {
  let cursor = isPerfectDay(state, todayKey) ? todayKey : shiftDate(todayKey, -1);
  let n = 0;
  while (isPerfectDay(state, cursor)) {
    n++;
    cursor = shiftDate(cursor, -1);
    if (n > 3650) break; // paranoia
  }
  return n;
}

// ── Actions ─────────────────────────────────────────────────────────────────

export type Action =
  | { type: "toggleHabit"; date: string; habitId: string }
  | { type: "addSession"; session: Session }
  | { type: "removeSession"; id: string }
  | { type: "setProfile"; patch: Partial<Profile> }
  | { type: "setTheme"; themeId: string }
  | { type: "completeOnboarding" }
  | { type: "addWeight"; date: string; kg: number }
  | { type: "addWater"; date: string; ml: number }
  | { type: "addCalories"; date: string; kcal: number; protein?: number }
  | { type: "setNote"; date: string; note: Note }
  | { type: "togglePrayer"; date: string; prayerId: string }
  | { type: "payPrayerDebt"; prayerId: string; count: number }
  | { type: "setPrayerDebt"; prayerId: string; count: number }
  | { type: "setModule"; key: "prayers"; on: boolean }
  | { type: "setPlace"; place: Place }
  | { type: "mergeHealth"; date: string; day: DailyHealth }
  | { type: "syncAutoSessions"; date: string; sessions: Session[] }
  | { type: "replace"; state: AppState };

function upsertByDate<T extends { date: string }>(list: T[], entry: T): T[] {
  const out = list.filter((e) => e.date !== entry.date).concat(entry);
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "toggleHabit": {
      const day = { ...(state.done[action.date] ?? {}) };
      const wasDone = !!day[action.habitId];
      if (wasDone) delete day[action.habitId];
      else day[action.habitId] = true;

      const wasPerfect = isPerfectDay(state, action.date);
      const next: AppState = { ...state, done: { ...state.done, [action.date]: day } };
      const nowPerfect = isPerfectDay(next, action.date);

      let xp = state.xp + (wasDone ? -XP_PER_HABIT : XP_PER_HABIT);
      if (!wasPerfect && nowPerfect) xp += XP_PERFECT_DAY;
      if (wasPerfect && !nowPerfect) xp -= XP_PERFECT_DAY;
      next.xp = Math.max(0, xp);

      const current = computeStreak(next, action.date);
      next.streak = {
        current,
        best: Math.max(state.streak.best, current),
        lastDay: action.date,
      };
      return next;
    }

    case "addSession":
      return {
        ...state,
        sessions: [...state.sessions, action.session].sort((a, b) => a.date.localeCompare(b.date)),
        xp: state.xp + XP_PER_SESSION,
      };

    case "removeSession":
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== action.id),
        xp: Math.max(0, state.xp - XP_PER_SESSION),
      };

    case "setProfile":
      return { ...state, profile: { ...state.profile, ...action.patch } };

    case "setTheme":
      return { ...state, themeId: action.themeId };

    case "completeOnboarding":
      return { ...state, onboarded: true };

    case "addWeight":
      return { ...state, weight: upsertByDate(state.weight, { date: action.date, kg: action.kg }) };

    case "addWater":
      return { ...state, water: upsertByDate(state.water, { date: action.date, ml: action.ml }) };

    case "addCalories":
      return {
        ...state,
        calories: upsertByDate(state.calories, {
          date: action.date,
          kcal: action.kcal,
          protein: action.protein,
        }),
      };

    case "setNote":
      return { ...state, notes: { ...state.notes, [action.date]: action.note } };

    case "togglePrayer": {
      const day = { ...(state.prayers.done[action.date] ?? {}) };
      const was = !!day[action.prayerId];
      if (was) delete day[action.prayerId];
      else day[action.prayerId] = true;

      const countBefore = PRAYERS.filter((p) => state.prayers.done[action.date]?.[p.id]).length;
      const countAfter = PRAYERS.filter((p) => day[p.id]).length;
      let xp = state.xp + (was ? -XP_PER_PRAYER : XP_PER_PRAYER);
      const full = PRAYERS.length;
      if (countBefore < full && countAfter === full) xp += XP_ALL_PRAYERS;
      if (countBefore === full && countAfter < full) xp -= XP_ALL_PRAYERS;

      return {
        ...state,
        xp: Math.max(0, xp),
        prayers: {
          ...state.prayers,
          done: { ...state.prayers.done, [action.date]: day },
        },
      };
    }

    case "payPrayerDebt": {
      const owed = Math.max(0, state.prayers.debt[action.prayerId] ?? 0);
      // Never repay more than is actually owed, however many times it is tapped.
      const paid = Math.min(Math.max(0, action.count), owed);
      if (!paid) return state;
      return {
        ...state,
        xp: state.xp + paid * XP_PER_DEBT_PRAYER,
        prayers: {
          ...state.prayers,
          debt: { ...state.prayers.debt, [action.prayerId]: owed - paid },
        },
      };
    }

    case "setPrayerDebt":
      return {
        ...state,
        prayers: {
          ...state.prayers,
          debt: {
            ...state.prayers.debt,
            [action.prayerId]: Math.max(0, Math.round(action.count) || 0),
          },
        },
      };

    case "setModule":
      // Turning a module off hides it. It never deletes what it recorded.
      return { ...state, modules: { ...state.modules, [action.key]: action.on } };

    case "setPlace":
      return { ...state, place: action.place };

    case "mergeHealth": {
      // Fill gaps only. A reading that is already stored is never overwritten
      // with undefined, so a partial sync cannot blank a good day.
      const existing = state.health[action.date] ?? { date: action.date };
      const merged: DailyHealth = { ...existing };
      for (const [k, v] of Object.entries(action.day)) {
        if (v === undefined || v === null || v === "") continue;
        (merged as unknown as Record<string, unknown>)[k] = v;
      }
      return { ...state, health: { ...state.health, [action.date]: merged } };
    }

    case "syncAutoSessions": {
      // Replace only what a previous sync imported for this day. Anything
      // logged by hand stays exactly where it is.
      const kept = state.sessions.filter(
        (s) => !(s.date === action.date && s.auto && s.id.startsWith("gh_")),
      );
      return {
        ...state,
        sessions: [...kept, ...action.sessions].sort((a, b) => a.date.localeCompare(b.date)),
      };
    }

    case "replace":
      return action.state;

    default:
      return state;
  }
}

// ── Persistence ─────────────────────────────────────────────────────────────

export type StateSource = "v3" | "v2" | "new";

export function loadState(): { state: AppState; source: StateSource } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 3)
        return { state: { ...emptyState(), ...parsed }, source: "v3" };
    }
  } catch {
    /* fall through to the legacy blob */
  }

  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (looksLikeV2(parsed)) return { state: migrateV2(parsed), source: "v2" };
    }
  } catch {
    /* fall through to a fresh state */
  }

  return { state: emptyState(), source: "new" };
}

/** Returns false when the write failed — a full disk must never fail silently. */
export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// ── React plumbing ──────────────────────────────────────────────────────────

export interface Store {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  /** True when the last save failed (device storage full). */
  saveFailed: boolean;
  /** Where the loaded state came from, for the one-time migration notice. */
  source: StateSource;
}

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/** Hook that owns the state; StoreProvider renders the context around it. */
export function useCreateStore(): Store {
  const [{ state: initial, source }] = useState(loadState);
  const [state, dispatch] = useReducer(reducer, initial);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    setSaveFailed(!saveState(state));
  }, [state]);

  return { state, dispatch, saveFailed, source };
}
