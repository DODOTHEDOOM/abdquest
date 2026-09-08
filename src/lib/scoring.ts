// Scoring, penalties, milestones and achievements — extracted verbatim from
// legacy/AbdQuest.html. Logic unchanged; only typed and made importable.

import { getLvl } from "./levels";

/** The persisted game-state blob. Typed loosely for now (Phase 3 tightens this). */
export type GameState = Record<string, any>;

export const PIDs = ["fajr", "duhr", "asr", "maghrib", "isha"] as const;

export const DEF_DEBT = { fajr: 15, duhr: 15, asr: 15, maghrib: 15, isha: 15 };

export const TIERC: Record<string, string> = {
  bronze: "#cd7f32",
  silver: "#c8c8d0",
  gold: "#ffd479",
  legendary: "#c0a3ff",
};

/** XP lost for missing a habit for `days` consecutive days (caps at the habit's full XP). */
export function getPenalty(xp: number, days: number): number {
  if (days <= 0) return 0;
  return Math.round(xp * Math.min(1, 0.2 + (days - 1) * 0.13));
}

/** Colour for a "missed N days" badge, or null when nothing is missed. */
export function getMissColor(d: number): string | null {
  if (!d) return null;
  if (d === 1) return "#ddaa22";
  if (d <= 2) return "#dd7722";
  if (d <= 4) return "#cc3322";
  return "#aa1111";
}

export function getSleepQ(hrs: number): { label: string; color: string } {
  if (hrs < 5) return { label: "Bad", color: "#cc3322" };
  if (hrs < 7) return { label: "Average", color: "#ddaa22" };
  if (hrs < 9) return { label: "Good", color: "#44aa44" };
  return { label: "Excellent", color: "#4488ff" };
}

export interface Milestone {
  days: number;
  xp: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  title: string | null;
  msg: string;
}

export const MILESTONES: Milestone[] = [
  { days: 3, xp: 50, rarity: "common", title: null, msg: "3 days. Good start." },
  { days: 7, xp: 100, rarity: "rare", title: null, msg: "One week. You actually did it." },
  { days: 10, xp: 150, rarity: "rare", title: "The Consistent", msg: "10 days. Habit is forming." },
  {
    days: 14,
    xp: 200,
    rarity: "epic",
    title: "Two Weeks Strong",
    msg: "2 weeks. People notice change.",
  },
  {
    days: 25,
    xp: 350,
    rarity: "epic",
    title: "Quarter Century",
    msg: "25 days. This is becoming who you are.",
  },
  {
    days: 50,
    xp: 600,
    rarity: "legendary",
    title: "The Disciplined",
    msg: "50 days. Half a century of showing up.",
  },
  {
    days: 100,
    xp: 1000,
    rarity: "legendary",
    title: "Centurion",
    msg: "100 days. Most people quit by day 3.",
  },
  {
    days: 200,
    xp: 2000,
    rarity: "legendary",
    title: "The Unbreakable",
    msg: "200 days. You are built different.",
  },
  {
    days: 365,
    xp: 5000,
    rarity: "legendary",
    title: "One Full Year",
    msg: "365 days. Abdelrahman — you did it.",
  },
];

// ── Achievement helpers ──────────────────────────────────────────────────────
export function achWkCount(s: GameState): number {
  let c = 0;
  const w = s.workoutSessions || {};
  for (const k in w) if (Object.prototype.hasOwnProperty.call(w, k)) c += (w[k] || []).length;
  return c;
}

export function achStepBest(s: GameState): number {
  let m = 0;
  const l = s.stepLog || {};
  for (const k in l) if (Object.prototype.hasOwnProperty.call(l, k)) m = Math.max(m, l[k] || 0);
  return m;
}

export function achWtLost(s: GameState): number {
  const w = s.wtLog || [];
  if (!w.length) return 0;
  const last = w[w.length - 1].wt;
  return Math.max(0, (s.startWt || last) - last);
}

export function achPrayerDays(s: GameState): number {
  const ph = s.prayerHist || {};
  let c = 0;
  for (const k in ph) {
    if (!Object.prototype.hasOwnProperty.call(ph, k)) continue;
    const d = ph[k];
    if (PIDs.every((p) => d && d[p])) c++;
  }
  if (PIDs.every((p) => s.done && s.done[p])) c++;
  return c;
}

export function achPerfectDays(s: GameState): number {
  const nb = ([] as any[]).concat(s.habits || [], s.prayers || [], s.life || []);
  if (!nb.length) return 0;
  let c = 0;
  (s.log || []).forEach((e: any) => {
    if (nb.every((hh) => e.done && e.done[hh.id])) c++;
  });
  if (nb.every((hh) => s.done && s.done[hh.id])) c++;
  return c;
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  coins: number;
  desc: string;
  check: (s: GameState) => boolean;
}

export const ACHV: Achievement[] = [
  {
    id: "a_st3",
    name: "First Steps",
    icon: "🌱",
    tier: "bronze",
    coins: 25,
    desc: "Reach a 3-day streak",
    check: (s) => s.streak >= 3,
  },
  {
    id: "a_st7",
    name: "One Week Strong",
    icon: "🔥",
    tier: "silver",
    coins: 60,
    desc: "Reach a 7-day streak",
    check: (s) => s.streak >= 7,
  },
  {
    id: "a_st14",
    name: "Fortnight",
    icon: "⚡",
    tier: "silver",
    coins: 90,
    desc: "Reach a 14-day streak",
    check: (s) => s.streak >= 14,
  },
  {
    id: "a_st30",
    name: "Unstoppable",
    icon: "💎",
    tier: "gold",
    coins: 160,
    desc: "Reach a 30-day streak",
    check: (s) => s.streak >= 30,
  },
  {
    id: "a_st100",
    name: "Centurion",
    icon: "👑",
    tier: "legendary",
    coins: 400,
    desc: "Reach a 100-day streak",
    check: (s) => s.streak >= 100,
  },
  {
    id: "a_lv5",
    name: "Getting Going",
    icon: "⭐",
    tier: "bronze",
    coins: 25,
    desc: "Reach level 5",
    check: (s) => getLvl(s.xp).level >= 5,
  },
  {
    id: "a_lv10",
    name: "Seasoned",
    icon: "🌟",
    tier: "silver",
    coins: 70,
    desc: "Reach level 10",
    check: (s) => getLvl(s.xp).level >= 10,
  },
  {
    id: "a_lv25",
    name: "Veteran",
    icon: "✨",
    tier: "gold",
    coins: 160,
    desc: "Reach level 25",
    check: (s) => getLvl(s.xp).level >= 25,
  },
  {
    id: "a_lv50",
    name: "Ascended",
    icon: "🏆",
    tier: "legendary",
    coins: 450,
    desc: "Reach the max level 50",
    check: (s) => getLvl(s.xp).level >= 50,
  },
  {
    id: "a_wk1",
    name: "First Sweat",
    icon: "💪",
    tier: "bronze",
    coins: 25,
    desc: "Log your first workout",
    check: (s) => achWkCount(s) >= 1,
  },
  {
    id: "a_wk25",
    name: "Gym Regular",
    icon: "🏋️",
    tier: "silver",
    coins: 90,
    desc: "Log 25 workouts",
    check: (s) => achWkCount(s) >= 25,
  },
  {
    id: "a_wk100",
    name: "Iron Discipline",
    icon: "⚙️",
    tier: "gold",
    coins: 220,
    desc: "Log 100 workouts",
    check: (s) => achWkCount(s) >= 100,
  },
  {
    id: "a_step10",
    name: "10K Club",
    icon: "👟",
    tier: "bronze",
    coins: 30,
    desc: "Hit 10,000 steps in a day",
    check: (s) => achStepBest(s) >= 10000,
  },
  {
    id: "a_step20",
    name: "Marathon Legs",
    icon: "🦵",
    tier: "gold",
    coins: 160,
    desc: "Hit 20,000 steps in a day",
    check: (s) => achStepBest(s) >= 20000,
  },
  {
    id: "a_wt5",
    name: "Lighter",
    icon: "⚖️",
    tier: "silver",
    coins: 90,
    desc: "Lose 5kg from your start weight",
    check: (s) => achWtLost(s) >= 5,
  },
  {
    id: "a_wt15",
    name: "Transformed",
    icon: "🌟",
    tier: "legendary",
    coins: 450,
    desc: "Lose 15kg from your start weight",
    check: (s) => achWtLost(s) >= 15,
  },
  {
    id: "a_pr1",
    name: "Five for Five",
    icon: "🕌",
    tier: "bronze",
    coins: 30,
    desc: "Complete all 5 daily prayers in one day",
    check: (s) => achPrayerDays(s) >= 1,
  },
  {
    id: "a_pr30",
    name: "Devout",
    icon: "📿",
    tier: "gold",
    coins: 220,
    desc: "Complete all 5 prayers on 30 days",
    check: (s) => achPrayerDays(s) >= 30,
  },
  {
    id: "a_perf1",
    name: "Flawless Day",
    icon: "✅",
    tier: "silver",
    coins: 60,
    desc: "Complete every quest in a single day",
    check: (s) => achPerfectDays(s) >= 1,
  },
  {
    id: "a_perfS",
    name: "Top of the Class",
    icon: "🥇",
    tier: "gold",
    coins: 200,
    desc: "Earn an S grade on a weekly review",
    check: (s) => (s.reportCards || []).some((r: any) => r.grade === "S"),
  },
];
