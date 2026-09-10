/**
 * Shared types for the metrics engine.
 *
 * IMPORTANT: every score here is an *estimate* built from published, citable
 * methods (see each module). None of it is a medical device or medical advice,
 * and none of it copies any proprietary vendor algorithm.
 */

/** One hour bucket of heart-rate samples (index 0..23 = hour of local day). */
export interface HourHR {
  avg: number;
  min: number;
  max: number;
}

/** A single day of health data, as stored in `fbDaily[date]` + the day logs. */
export interface DailyHealth {
  date: string; // YYYY-MM-DD (local)
  rhr?: number; // resting heart rate, bpm
  hrv?: number; // heart-rate variability, ms
  resp?: number; // respiratory rate during sleep, breaths/min
  spo2?: number; // blood oxygen, %
  vo2max?: number; // device-reported VO2max, ml/kg/min
  hrAvg?: number;
  hrMin?: number;
  hrMax?: number;
  /** 24 hourly buckets; null where there were no samples. */
  hrSeries?: (HourHR | null)[] | null;
  sleepHrs?: number;
  sleepStart?: string | null; // "HH:MM" local
  sleepEnd?: string | null; // "HH:MM" local
  steps?: number;
  azm?: number; // active zone minutes
  calOut?: number;
  /** Minutes of logged workouts on this day (any type). */
  workoutMins?: number;
}

export interface Profile {
  age?: number;
  sex?: "male" | "female" | "other";
  weightKg?: number;
  heightCm?: number;
  /** Measured max HR if known; otherwise estimated from age (Tanaka). */
  hrMax?: number;
  /** Baseline nightly sleep need in hours. */
  sleepNeedHrs?: number;
  /** Self-reported activity level 0..7 for the non-exercise VO2max estimate. */
  activityRating?: number;
}

/** One weighted input to a composite score. */
export interface ScoreComponent {
  key: string;
  label: string;
  /** 0..1 sub-score, or null when there is no data (it is then excluded). */
  score: number | null;
  /** Intended weight before re-weighting for missing inputs. */
  weight: number;
  /** Human-readable current value, e.g. "54 bpm". */
  display: string;
  /** What it was compared against, e.g. "baseline 58 bpm". */
  context?: string;
}

export interface CompositeScore {
  /** 0..100, or null when nothing could be scored. */
  score: number | null;
  band: "low" | "moderate" | "good" | "peak";
  label: string;
  components: ScoreComponent[];
  /** Weight actually used (sums the weights of components that had data). */
  coverage: number;
}

export const DEFAULT_SLEEP_NEED_HRS = 8;

/** Tanaka et al. (2001): HRmax ≈ 208 − 0.7 × age. */
export function estimateHrMax(profile: Profile): number {
  if (profile.hrMax && profile.hrMax > 100) return profile.hrMax;
  const age = profile.age && profile.age > 0 ? profile.age : 30;
  return Math.round(208 - 0.7 * age);
}

export function bandFor(score: number): CompositeScore["band"] {
  if (score >= 85) return "peak";
  if (score >= 67) return "good";
  if (score >= 34) return "moderate";
  return "low";
}
