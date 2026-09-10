/**
 * Deterministic sample health history, used only by the design preview so the
 * dashboard renders real numbers from the real metrics engine (rather than
 * hardcoded mockup values). Deleted once the app is wired to live data.
 */

import { ymd } from "./dates";
import type { DailyHealth, HourHR, Profile } from "./metrics/types";

/** Small deterministic PRNG so the preview looks the same every reload. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const DEMO_PROFILE: Profile = {
  age: 22,
  sex: "male",
  weightKg: 96,
  heightCm: 178,
  sleepNeedHrs: 8,
};

function hrDay(rand: () => number, hard: boolean, rhr: number): (HourHR | null)[] {
  const out: (HourHR | null)[] = [];
  for (let h = 0; h < 24; h++) {
    if (h < 7) {
      out.push({ avg: Math.round(rhr - 2 + rand() * 4), min: rhr - 6, max: rhr + 4 });
    } else if (hard && h >= 18 && h < 20) {
      const v = Math.round(128 + rand() * 26);
      out.push({ avg: v, min: v - 22, max: v + 18 });
    } else {
      const v = Math.round(rhr + 14 + rand() * 18);
      out.push({ avg: v, min: v - 8, max: v + 20 });
    }
  }
  return out;
}

export function demoHistory(days = 45): DailyHealth[] {
  const rand = rng(20260210);
  const out: DailyHealth[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    // Trend: fitness slowly improving over the window.
    const trend = (days - i) / days;
    // Mon/Wed/Fri are training days — and always make "today" one so the
    // preview shows a populated day rather than an empty rest day.
    const hard = i === 0 || dow === 1 || dow === 3 || dow === 5;
    const rhr = Math.round(58 - trend * 4 + (rand() - 0.5) * 3);
    const hrv = Math.round(48 + trend * 12 + (rand() - 0.5) * 14 - (hard ? 4 : 0));
    const sleepHrs =
      Math.round((6.4 + rand() * 2.1 + (dow === 0 || dow === 6 ? 0.5 : 0)) * 10) / 10;
    const bedHour = 22 + Math.floor(rand() * 3); // 22–24
    out.push({
      date: ymd(d),
      rhr,
      hrv,
      resp: Math.round((14.2 + (rand() - 0.5) * 1.4) * 10) / 10,
      spo2: Math.round(95 + rand() * 3),
      vo2max: Math.round((41 + trend * 4 + (rand() - 0.5) * 0.8) * 10) / 10,
      sleepHrs,
      sleepStart: `${String(bedHour % 24).padStart(2, "0")}:${rand() > 0.5 ? "15" : "45"}`,
      sleepEnd: "06:50",
      steps: Math.round(5200 + rand() * 9000 + (hard ? 2500 : 0)),
      azm: Math.round(hard ? 40 + rand() * 45 : rand() * 22),
      calOut: Math.round(2400 + rand() * 700),
      workoutMins: hard ? Math.round(45 + rand() * 30) : 0,
      hrSeries: hrDay(rand, hard, rhr),
      hrAvg: Math.round(rhr + 18),
      hrMin: rhr - 5,
      hrMax: hard ? Math.round(160 + rand() * 15) : Math.round(120 + rand() * 20),
    });
  }
  return out;
}
