/**
 * Sample training history for the preview, so the Training screen and the
 * motivation engine have something real to chew on. Replaced by live data when
 * the store lands.
 */

import { ymd } from "./dates";
import { libraryFromSessions, type Exercise, type GymSet, type Session } from "./training";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const LIFTS: {
  id: string;
  name: string;
  metric: "weight" | "bodyweight";
  start: number;
  step: number;
}[] = [
  { id: "ex_bench", name: "Bench press", metric: "weight", start: 62.5, step: 2.5 },
  { id: "ex_squat", name: "Back squat", metric: "weight", start: 80, step: 5 },
  { id: "ex_dead", name: "Deadlift", metric: "weight", start: 100, step: 5 },
  { id: "ex_row", name: "Barbell row", metric: "weight", start: 50, step: 2.5 },
  { id: "ex_ohp", name: "Overhead press", metric: "weight", start: 35, step: 2.5 },
  { id: "ex_pullup", name: "Pull-ups", metric: "bodyweight", start: 7, step: 1 },
];

const SPORTS = [
  { id: "football", minutes: 90 },
  { id: "padel", minutes: 60 },
  { id: "basketball", minutes: 75 },
];

/** Roughly six weeks of mixed training: gym, cardio and a weekly sport. */
export function demoSessions(days = 45): Session[] {
  const rand = rng(7761);
  const out: Session[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = ymd(d);
    const dow = d.getDay();
    const week = Math.floor((days - 1 - i) / 7); // progressive overload by week

    // Mon / Wed / Fri: gym. Two lifts each.
    if (dow === 1 || dow === 3 || dow === 5) {
      const picks = dow === 1 ? [0, 3] : dow === 3 ? [1, 5] : [2, 4];
      for (const p of picks) {
        const lift = LIFTS[p];
        if (lift.metric === "bodyweight") {
          const base = Math.round(lift.start + week * lift.step);
          const sets: GymSet[] = [
            { reps: base, weight: 0 },
            { reps: Math.max(3, base - 2), weight: 0 },
            { reps: Math.max(3, base - 3), weight: 0 },
          ];
          out.push({
            id: `g_${date}_${lift.id}`,
            date,
            activityId: "gym",
            kind: "gym",
            exerciseId: lift.id,
            name: lift.name,
            metric: "bodyweight",
            sets,
          });
        } else {
          const top = lift.start + week * lift.step;
          const sets: GymSet[] = [
            { reps: 10, weight: Math.round((top - lift.step * 2) * 2) / 2 },
            { reps: 8, weight: Math.round((top - lift.step) * 2) / 2 },
            { reps: 5, weight: Math.round(top * 2) / 2 },
          ];
          out.push({
            id: `g_${date}_${lift.id}`,
            date,
            activityId: "gym",
            kind: "gym",
            exerciseId: lift.id,
            name: lift.name,
            metric: "weight",
            sets,
          });
        }
      }
    }

    // Tue / Thu: easy cardio.
    if (dow === 2 || dow === 4) {
      const isRun = dow === 2;
      out.push({
        id: `c_${date}`,
        date,
        activityId: isRun ? "run" : "swim",
        kind: "cardio",
        minutes: isRun ? 28 + Math.round(rand() * 12) : 35,
        distanceKm: isRun ? Math.round((4.5 + rand() * 2.5) * 10) / 10 : 1.2,
        intensity: "steady",
        avgHr: 138 + Math.round(rand() * 14),
      });
    }

    // Saturday: a sport.
    if (dow === 6) {
      const sp = SPORTS[(days - i) % SPORTS.length];
      out.push({
        id: `s_${date}`,
        date,
        activityId: sp.id,
        kind: "sport",
        minutes: sp.minutes,
        intensity: rand() > 0.5 ? "hard" : "steady",
        avgHr: 145 + Math.round(rand() * 20),
      });
    }
  }
  return out;
}

export function demoLibrary(sessions: Session[]): Exercise[] {
  return libraryFromSessions(sessions);
}
