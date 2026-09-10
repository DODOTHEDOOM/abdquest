/**
 * Cardiovascular strain / daily effort, on a 0–21 scale.
 *
 * Method: Banister's Training Impulse (TRIMP) — Banister & Calvert (1980),
 * exponential weighting per Morton, Fitz-Clarke & Banister (1990):
 *
 *   HRr   = (HR − HRrest) / (HRmax − HRrest)          "heart-rate reserve"
 *   TRIMP = Σ  minutes × HRr × a × e^(b × HRr)
 *           a=0.64, b=1.92 (male) · a=0.86, b=1.67 (female)
 *
 * TRIMP is unbounded, so it is mapped onto a friendlier 0–21 scale with a
 * saturating curve calibrated so a hard training day (TRIMP ≈ 150) lands near
 * 14 and it becomes progressively harder to climb from there.
 *
 * The 0–21 range is a common convention for effort scales; the maths here is
 * the published TRIMP model, not any vendor's proprietary formula.
 */

import { clamp } from "./baseline";
import { estimateHrMax, type DailyHealth, type Profile } from "./types";

/** k chosen so TRIMP 150 → strain 14.0 on the 0–21 curve. */
const K = 0.007324;

/**
 * Minimum heart-rate reserve that counts as *effort*.
 *
 * TRIMP was designed for exercise bouts. Integrated naively across a whole day
 * it rewards simply being awake — sitting at ~15% of HR reserve for 16 hours
 * accumulates as much TRIMP as a hard session, which is nonsense. Anything
 * below roughly a fifth of heart-rate reserve is daily living, not training,
 * so it is excluded.
 */
const EFFORT_FLOOR = 0.2;

export interface StrainResult {
  /** 0–21. */
  strain: number;
  /** Raw Banister TRIMP for the day. */
  trimp: number;
  label: string;
  /** "hr" when computed from the heart-rate series, "estimated" from fallbacks. */
  source: "hr" | "estimated" | "none";
  /** Minutes spent in each HR zone (1–5), when an HR series was available. */
  zoneMins?: number[];
}

function labelFor(strain: number): string {
  if (strain >= 18) return "All out";
  if (strain >= 14) return "Strenuous";
  if (strain >= 10) return "Moderate";
  if (strain >= 5) return "Light";
  if (strain > 0) return "Minimal";
  return "Rest";
}

function trimpToStrain(trimp: number): number {
  const s = 21 * (1 - Math.exp(-K * trimp));
  return Math.round(clamp(s, 0, 21) * 10) / 10;
}

/** HR zone 1..5 by % of heart-rate reserve. */
function zoneOf(hrr: number): number {
  if (hrr < 0.35) return 1;
  if (hrr < 0.55) return 2;
  if (hrr < 0.7) return 3;
  if (hrr < 0.85) return 4;
  return 5;
}

export function strain(day: DailyHealth, profile: Profile = {}, restingHr?: number): StrainResult {
  const hrMax = estimateHrMax(profile);
  const rest = restingHr || day.rhr || 60;
  const female = profile.sex === "female";
  const a = female ? 0.86 : 0.64;
  const b = female ? 1.67 : 1.92;

  const series = day.hrSeries;
  if (series && series.some((h) => h && h.avg > 0) && hrMax > rest) {
    let trimp = 0;
    const zoneMins = [0, 0, 0, 0, 0];
    // NOTE: buckets are hourly, so a hard 40-minute session inside an hour gets
    // averaged down. That under-reports short intense workouts; finer-grained
    // samples would fix it if the API ever gives them to us.
    for (const hour of series) {
      if (!hour || !hour.avg) continue;
      const hrr = clamp((hour.avg - rest) / (hrMax - rest), 0, 1);
      if (hrr < EFFORT_FLOOR) continue;
      const minutes = 60;
      trimp += minutes * hrr * a * Math.exp(b * hrr);
      zoneMins[zoneOf(hrr) - 1] += minutes;
    }
    const s = trimpToStrain(trimp);
    return { strain: s, trimp: Math.round(trimp), label: labelFor(s), source: "hr", zoneMins };
  }

  // ── Fallback: no HR series. Approximate TRIMP from what we do have. ──────
  // Active zone minutes already weight vigorous effort double, so treat one AZM
  // as roughly one moderate TRIMP-minute plus a bit. Steps above a sedentary
  // floor contribute a small amount of light activity.
  const azm = day.azm || 0;
  const workout = day.workoutMins || 0;
  const steps = day.steps || 0;
  const stepMins = Math.max(0, (steps - 6000) / 110); // ~110 steps/min walking
  const est = azm * 1.8 + workout * 1.2 + stepMins * 0.6;
  if (est <= 0) return { strain: 0, trimp: 0, label: labelFor(0), source: "none" };
  const s = trimpToStrain(est);
  return { strain: s, trimp: Math.round(est), label: labelFor(s), source: "estimated" };
}
