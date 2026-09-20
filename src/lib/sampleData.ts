/**
 * Example data for someone looking around before committing to it.
 *
 * An empty habit tracker tells you nothing about whether it is worth using, so
 * the public edition offers to fill itself in. Two rules keep this honest:
 *
 *  - It is generated, never shipped as a fixture, so the dates are always
 *    relative to today and it never looks stale.
 *  - It is marked `isSample` in the state, so every screen showing it can say
 *    so, and clearing it is one tap. It must be impossible to mistake this for
 *    your own record.
 */

import type { DailyHealth } from "./metrics/types";
import type { Session } from "./training";
import { emptyState, type AppState } from "../state/schema";

function shift(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/**
 * A small deterministic generator, so the sample looks the same every time it
 * is created rather than flickering between reloads.
 */
function wobble(seed: number, spread: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * spread;
}

const HABITS = [
  { id: "s_move", name: "Move for 20 minutes", detail: "Walk, gym, anything.", icon: "🏃" },
  { id: "s_nojunk", name: "No junk food", detail: "No takeaway or binge snacking.", icon: "🥗" },
  { id: "s_sleep", name: "In bed before midnight", detail: "Lights actually out.", icon: "🌙" },
  { id: "s_read", name: "Read 20 minutes", detail: "Anything that is not a feed.", icon: "📖" },
];

export function sampleState(today: string): AppState {
  const base = emptyState();

  const done: AppState["done"] = {};
  const health: Record<string, DailyHealth> = {};
  const sessions: Session[] = [];
  const weight: AppState["weight"] = [];
  const water: AppState["water"] = [];

  for (let i = 59; i >= 0; i--) {
    const date = shift(today, -i);
    const day: Record<string, boolean> = {};

    // Good but not perfect: roughly four days in five are complete, with a
    // visible dip three weeks ago so the trends have something to show.
    const slump = i > 18 && i < 26;
    for (const h of HABITS) {
      const miss = slump ? wobble(i + h.id.length, 1) > 0.1 : wobble(i + h.id.length, 1) > 0.62;
      if (!miss) day[h.id] = true;
    }
    if (Object.keys(day).length) done[date] = day;

    const hrv = Math.round(62 + wobble(i, 7) - (slump ? 6 : 0));
    const rhr = Math.round(54 + wobble(i + 100, 2.5) + (slump ? 3 : 0));
    const sleepHrs = Math.round((7.3 + wobble(i + 200, 1.1) - (slump ? 0.8 : 0)) * 10) / 10;

    health[date] = {
      date,
      hrv,
      rhr,
      resp: Math.round((14.2 + wobble(i + 300, 0.6)) * 10) / 10,
      spo2: 96,
      vo2max: 44.8,
      steps: Math.round(9000 + wobble(i + 400, 3200)),
      azm: Math.round(28 + wobble(i + 500, 18)),
      calOut: Math.round(2650 + wobble(i + 600, 180)),
      sleepHrs: Math.max(4.5, sleepHrs),
      sleepStart: "23:20",
      sleepEnd: "06:55",
    };

    // Four sessions most weeks, alternating between the gym and something else.
    const dow = new Date(date + "T00:00:00").getDay();
    if ([1, 3, 5, 6].includes(dow) && !slump) {
      if (dow === 1 || dow === 5) {
        const heavier = Math.round(72 + (59 - i) * 0.25);
        sessions.push({
          id: `s_gym_${date}`,
          date,
          activityId: "gym",
          kind: "gym",
          exerciseId: "ex_bench",
          name: "Bench press",
          metric: "weight",
          sets: [
            { reps: 8, weight: heavier - 10 },
            { reps: 6, weight: heavier - 5 },
            { reps: 4, weight: heavier },
          ],
        });
      } else {
        sessions.push({
          id: `s_run_${date}`,
          date,
          activityId: dow === 3 ? "run" : "padel",
          kind: dow === 3 ? "cardio" : "sport",
          name: dow === 3 ? undefined : "Padel",
          minutes: dow === 3 ? 34 : 90,
          distanceKm: dow === 3 ? 5.4 : undefined,
          intensity: "steady",
          avgHr: dow === 3 ? 152 : 138,
        });
      }
    }

    if (i % 4 === 0) {
      weight.push({ date, kg: Math.round((84 - (59 - i) * 0.035 + wobble(i, 0.4)) * 10) / 10 });
    }
    water.push({ date, ml: Math.round(2400 + wobble(i + 700, 900)) });
  }

  return {
    ...base,
    profile: {
      ...base.profile,
      name: "Sam",
      age: 27,
      sex: "male",
      heightCm: 179,
      weightKg: weight[weight.length - 1]?.kg ?? 82,
      waterTargetMl: 3000,
      weightTargetKg: 78,
    },
    onboarded: true,
    themeId: "lagoon",
    habits: HABITS,
    done,
    streak: { current: 3, best: 16, lastDay: today },
    xp: 5200,
    sessions,
    health,
    weight,
    water,
    notes: {
      [shift(today, -1)]: { text: "Legs felt heavy but the bench moved well.", mood: "good" },
      [shift(today, -4)]: { text: "Slept badly, took the day off. Right call.", mood: "tired" },
    },
    isSample: true,
  };
}
