/**
 * The persisted app state (v3).
 *
 * Stored under a NEW key. The old `abdquest_v2` blob is never written to and
 * never deleted — if anything here goes wrong, the original app still opens
 * with every byte of its data intact.
 */

import type { DailyHealth } from "../lib/metrics/types";
import type { Exercise, Session } from "../lib/training";
import { libraryFromSessions } from "../lib/training";

export const STORAGE_KEY = "abdquest_v3";
export const LEGACY_KEY = "abdquest_v2";

export interface Habit {
  id: string;
  name: string;
  detail?: string;
  icon?: string;
  /** Bonus habits do not count against a perfect day. */
  bonus?: boolean;
}

export interface Profile {
  name?: string;
  age?: number;
  sex?: "male" | "female" | "other";
  heightCm?: number;
  weightKg?: number;
  sleepNeedHrs?: number;
  /** Daily targets. Undefined means "not set" — nothing is assumed for you. */
  weightTargetKg?: number;
  waterTargetMl?: number;
  kcalTarget?: number;
  proteinTargetG?: number;
}

export interface WeightEntry {
  date: string;
  kg: number;
}
export interface CalorieEntry {
  date: string;
  kcal: number;
  protein?: number;
}
export interface WaterEntry {
  date: string;
  ml: number;
}
export interface Note {
  text: string;
  mood?: string;
}

/**
 * The five daily prayers. `apiKey` is the name the Aladhan timings API uses,
 * which does not always match the spelling shown in the app.
 */
export const PRAYERS = [
  { id: "fajr", name: "Fajr", icon: "🌅", apiKey: "Fajr", detail: "Dawn" },
  { id: "duhr", name: "Duhr", icon: "☀️", apiKey: "Dhuhr", detail: "Midday" },
  { id: "asr", name: "Asr", icon: "🌤️", apiKey: "Asr", detail: "Afternoon" },
  { id: "maghrib", name: "Maghrib", icon: "🌇", apiKey: "Maghrib", detail: "Sunset" },
  { id: "isha", name: "Isha", icon: "🌙", apiKey: "Isha", detail: "Night" },
] as const;

export type PrayerId = (typeof PRAYERS)[number]["id"];

export interface PrayerState {
  /** date -> prayer id -> prayed. */
  done: Record<string, Record<string, boolean>>;
  /** Missed prayers still owed, per prayer. */
  debt: Record<string, number>;
}

/** Where to compute prayer times for. Set once, from the device or by hand. */
export interface Place {
  lat: number;
  lon: number;
  label?: string;
}

export interface AppState {
  version: 3;
  profile: Profile;
  onboarded: boolean;
  themeId: string;
  habits: Habit[];
  /** date -> habitId -> done. Keeping full history makes every streak recomputable. */
  done: Record<string, Record<string, boolean>>;
  streak: { current: number; best: number; lastDay: string | null };
  xp: number;
  sessions: Session[];
  /** date -> wearable readings for that day. */
  health: Record<string, DailyHealth>;
  weight: WeightEntry[];
  calories: CalorieEntry[];
  water: WaterEntry[];
  notes: Record<string, Note>;
  /** Optional sections. Off means the tab and its data are simply not shown. */
  modules: { prayers: boolean };
  prayers: PrayerState;
  place?: Place;
  /**
   * True when this is generated example data rather than the user's own.
   * Every screen that can show it says so, and it can be cleared in one tap.
   */
  isSample?: boolean;
  /** Where this state came from, for the one-time "your data moved across" notice. */
  migratedFrom?: "v2" | null;
}

export const DEFAULT_HABITS: Habit[] = [
  {
    id: "move",
    name: "Move for 20 minutes",
    detail: "Walk, gym, anything that raises your heart rate.",
    icon: "🏃",
  },
  {
    id: "nojunk",
    name: "No junk food",
    detail: "No crisps, takeaway or binge snacking.",
    icon: "🥗",
  },
  {
    id: "sleep",
    name: "In bed before 1am",
    detail: "Lights out — scrolling in bed does not count.",
    icon: "🌙",
  },
  {
    id: "water",
    name: "Drink 3L of water",
    detail: "Roughly six large glasses across the day.",
    icon: "💧",
  },
  {
    id: "read",
    name: "Read 20 minutes",
    detail: "Book, article, anything that is not a feed.",
    icon: "📖",
  },
];

export function emptyState(): AppState {
  return {
    version: 3,
    profile: { sleepNeedHrs: 8 },
    onboarded: false,
    themeId: "daylight",
    habits: DEFAULT_HABITS,
    done: {},
    streak: { current: 0, best: 0, lastDay: null },
    xp: 0,
    sessions: [],
    health: {},
    weight: [],
    calories: [],
    water: [],
    notes: {},
    modules: { prayers: false },
    prayers: { done: {}, debt: {} },
    migratedFrom: null,
  };
}

// ── Derived ─────────────────────────────────────────────────────────────────

export function habitsDoneOn(state: AppState, date: string): number {
  const day = state.done[date];
  if (!day) return 0;
  return state.habits.filter((h) => day[h.id]).length;
}

export function isPerfectDay(state: AppState, date: string): boolean {
  const required = state.habits.filter((h) => !h.bonus);
  if (!required.length) return false;
  const day = state.done[date] ?? {};
  return required.every((h) => day[h.id]);
}

export function prayersDoneOn(state: AppState, date: string): number {
  const day = state.prayers.done[date];
  if (!day) return 0;
  return PRAYERS.filter((p) => day[p.id]).length;
}

export function allPrayersOn(state: AppState, date: string): boolean {
  return prayersDoneOn(state, date) === PRAYERS.length;
}

export function prayerDebtTotal(state: AppState): number {
  return Object.values(state.prayers.debt).reduce((a, b) => a + Math.max(0, b), 0);
}

/** Library is always derived from sessions, so the two can never disagree. */
export function libraryOf(state: AppState): Exercise[] {
  return libraryFromSessions(state.sessions);
}

// ── Levels ──────────────────────────────────────────────────────────────────

/**
 * Total XP needed to reach a level: 50 · n · (n−1).
 * Level 2 at 100, level 5 at 1,000, level 10 at 4,500, level 20 at 19,000 —
 * quick wins early, a real climb later.
 */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  // Invert 50n(n-1) = xp.
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2));
}

export interface LevelProgress {
  level: number;
  /** XP earned since reaching this level. */
  into: number;
  /** XP the whole level is worth. */
  need: number;
  pct: number;
  toNext: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const need = next - base;
  const into = Math.max(0, xp - base);
  return { level, into, need, pct: need > 0 ? into / need : 0, toNext: Math.max(0, next - xp) };
}
