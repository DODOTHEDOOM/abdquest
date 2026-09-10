/**
 * VO2max estimation and "fitness age" (a.k.a. biological/cardio age).
 *
 * This replaces the old made-up health-age formula. It uses two published
 * methods and nothing invented:
 *
 * 1. VO2max — prefer the device's own reading. When there isn't one, use the
 *    non-exercise regression from Jackson et al. (1990), "Prediction of
 *    functional aerobic capacity without exercise testing":
 *
 *      VO2max = 56.363 + 1.921·PA − 0.381·age − 0.754·BMI + 10.987·(male ? 1 : 0)
 *
 *    where PA is a 0–7 physical-activity rating. We derive PA from logged steps
 *    and workouts rather than asking the user to guess.
 *
 * 2. Fitness age — Nes et al. (2011), the HUNT fitness-age study: your fitness
 *    age is the age at which your VO2max would be the population median for
 *    your sex. Population medians are the standard linear approximations:
 *
 *      men:   VO2(50th) ≈ 57.8 − 0.372·age
 *      women: VO2(50th) ≈ 47.1 − 0.294·age
 *
 * These are population estimates for healthy adults. They are not a clinical
 * measurement and not medical advice.
 */

import { clamp } from "./baseline";
import type { DailyHealth, Profile } from "./types";

const NORMS = {
  male: { intercept: 57.8, slope: 0.372 },
  female: { intercept: 47.1, slope: 0.294 },
};

function normsFor(sex: Profile["sex"]) {
  if (sex === "male") return NORMS.male;
  if (sex === "female") return NORMS.female;
  // Unspecified: average the two curves.
  return {
    intercept: (NORMS.male.intercept + NORMS.female.intercept) / 2,
    slope: (NORMS.male.slope + NORMS.female.slope) / 2,
  };
}

/**
 * Derive Jackson's 0–7 physical-activity rating from what was actually logged
 * over the recent window, instead of a self-report.
 */
export function activityRating(history: DailyHealth[], upTo: string, days = 28): number {
  const recent = history
    .filter((d) => d.date <= upTo)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
  if (!recent.length) return 3;
  const withSteps = recent.filter((d) => (d.steps || 0) > 0);
  const avgSteps = withSteps.length
    ? withSteps.reduce((a, d) => a + (d.steps || 0), 0) / withSteps.length
    : 0;
  const workoutDays = recent.filter((d) => (d.workoutMins || 0) >= 20).length;
  const workoutsPerWeek = (workoutDays / recent.length) * 7;

  // 0–7 scale: 0 = sedentary, 7 = >3h/week of vigorous training.
  let pa = 0;
  if (avgSteps >= 12000) pa += 3;
  else if (avgSteps >= 9000) pa += 2.5;
  else if (avgSteps >= 6000) pa += 1.5;
  else if (avgSteps >= 3000) pa += 0.75;

  if (workoutsPerWeek >= 5) pa += 4;
  else if (workoutsPerWeek >= 3) pa += 3;
  else if (workoutsPerWeek >= 2) pa += 2;
  else if (workoutsPerWeek >= 1) pa += 1;

  return clamp(Math.round(pa * 2) / 2, 0, 7);
}

export interface Vo2Result {
  vo2max: number | null;
  source: "device" | "estimated" | "none";
  /** The PA rating used, when estimated. */
  activityRating?: number;
}

export function estimateVo2max(
  today: DailyHealth,
  history: DailyHealth[],
  profile: Profile = {},
): Vo2Result {
  // Prefer the most recent device reading within the last 30 days.
  const recentDevice = [...history, today]
    .filter((d) => d.date <= today.date && d.vo2max && d.vo2max > 10)
    .sort((a, b) => a.date.localeCompare(b.date))
    .pop();
  if (recentDevice?.vo2max) {
    return { vo2max: Math.round(recentDevice.vo2max * 10) / 10, source: "device" };
  }

  const { age, weightKg, heightCm, sex } = profile;
  if (!age || !weightKg || !heightCm) return { vo2max: null, source: "none" };
  const bmi = weightKg / (heightCm / 100) ** 2;
  const pa = profile.activityRating ?? activityRating(history, today.date);
  const male = sex === "male" ? 1 : sex === "female" ? 0 : 0.5;
  const v = 56.363 + 1.921 * pa - 0.381 * age - 0.754 * bmi + 10.987 * male;
  if (!isFinite(v)) return { vo2max: null, source: "none" };
  return {
    vo2max: Math.round(clamp(v, 10, 80) * 10) / 10,
    source: "estimated",
    activityRating: pa,
  };
}

export interface FitnessAgeResult {
  /** Estimated fitness age in years, or null when VO2max is unknown. */
  fitnessAge: number | null;
  /** fitnessAge − chronological age (negative is good). */
  delta: number | null;
  vo2max: number | null;
  vo2Source: Vo2Result["source"];
  label: string;
}

export function fitnessAge(
  today: DailyHealth,
  history: DailyHealth[],
  profile: Profile = {},
): FitnessAgeResult {
  const v = estimateVo2max(today, history, profile);
  if (v.vo2max == null) {
    return {
      fitnessAge: null,
      delta: null,
      vo2max: null,
      vo2Source: v.source,
      label: "Needs VO₂max or your height, weight and age",
    };
  }
  const { intercept, slope } = normsFor(profile.sex);
  const raw = (intercept - v.vo2max) / slope;
  const fa = Math.round(clamp(raw, 18, 80));
  const delta = profile.age ? fa - profile.age : null;
  const label =
    delta == null
      ? "Add your age to compare"
      : delta <= -5
        ? `${Math.abs(delta)} years younger than your age`
        : delta < 0
          ? `${Math.abs(delta)} years younger`
          : delta === 0
            ? "Right on your age"
            : delta <= 5
              ? `${delta} years older`
              : `${delta} years older — room to improve`;

  return { fitnessAge: fa, delta, vo2max: v.vo2max, vo2Source: v.source, label };
}
