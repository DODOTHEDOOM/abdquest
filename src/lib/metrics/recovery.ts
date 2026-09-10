/**
 * Recovery / readiness (0–100).
 *
 * Method: compare today's autonomic markers against *your own* rolling 30-day
 * baseline, then blend. This is the standard HRV-guided readiness approach in
 * the sports-science literature (Plews et al. 2013; Buchheit 2014, "Monitoring
 * training status with HR measures"), not a copy of any vendor's score.
 *
 *   HRV vs baseline        50%   higher than your normal = better recovered
 *   Resting HR vs baseline 25%   lower than your normal  = better recovered
 *   Sleep performance      20%   actual / need
 *   Respiratory rate       5%    elevated = illness / incomplete recovery
 *
 * Missing inputs are dropped and the rest are re-weighted, so the score is
 * always built from real data rather than assumptions.
 */

import { clamp01, rollingBaseline, weightedScore, withSdFloor, zScore, zToScore } from "./baseline";

/**
 * Minimum spread, as a fraction of the baseline mean, before a z-score is
 * considered meaningful. Roughly the day-to-day coefficient of variation these
 * markers show in healthy adults — HRV is much noisier than resting HR.
 */
const SD_FLOOR = { hrv: 0.08, rhr: 0.04, resp: 0.04 };
import {
  bandFor,
  DEFAULT_SLEEP_NEED_HRS,
  type CompositeScore,
  type DailyHealth,
  type Profile,
  type ScoreComponent,
} from "./types";

function labelFor(band: CompositeScore["band"]): string {
  return band === "peak"
    ? "Primed"
    : band === "good"
      ? "Recovered"
      : band === "moderate"
        ? "Adequate"
        : "Run down";
}

export function recovery(
  today: DailyHealth,
  history: DailyHealth[],
  profile: Profile = {},
): CompositeScore {
  const need = profile.sleepNeedHrs || DEFAULT_SLEEP_NEED_HRS;

  // ── HRV: higher than baseline is better ──────────────────────────────────
  const hrvBase = rollingBaseline(history, today.date, (d) => d.hrv);
  let hrvScore: number | null = null;
  let hrvContext: string | undefined;
  if (today.hrv && hrvBase) {
    // −1.5 SD scores 0, +1.0 SD scores 1 — asymmetric because a big drop in HRV
    // is far more informative than a big rise.
    hrvScore = zToScore(zScore(today.hrv, withSdFloor(hrvBase, SD_FLOOR.hrv)), -1.5, 1.0);
    hrvContext = `baseline ${Math.round(hrvBase.mean)} ms`;
  } else if (today.hrv) {
    hrvContext = "building baseline";
  }

  // ── Resting HR: lower than baseline is better ────────────────────────────
  const rhrBase = rollingBaseline(history, today.date, (d) => d.rhr);
  let rhrScore: number | null = null;
  let rhrContext: string | undefined;
  if (today.rhr && rhrBase) {
    // Inverted: +1.5 SD (elevated RHR) scores 0, −1.0 SD scores 1.
    rhrScore = zToScore(-zScore(today.rhr, withSdFloor(rhrBase, SD_FLOOR.rhr)), -1.5, 1.0);
    rhrContext = `baseline ${Math.round(rhrBase.mean)} bpm`;
  } else if (today.rhr) {
    rhrContext = "building baseline";
  }

  // ── Sleep performance ────────────────────────────────────────────────────
  const sleepScore = today.sleepHrs && today.sleepHrs > 0 ? clamp01(today.sleepHrs / need) : null;

  // ── Respiratory rate: elevated vs baseline is a warning sign ─────────────
  const respBase = rollingBaseline(history, today.date, (d) => d.resp);
  let respScore: number | null = null;
  let respContext: string | undefined;
  if (today.resp && respBase) {
    respScore = zToScore(-zScore(today.resp, withSdFloor(respBase, SD_FLOOR.resp)), -2.0, 0.5);
    respContext = `baseline ${respBase.mean.toFixed(1)} br/min`;
  }

  const components: ScoreComponent[] = [
    {
      key: "hrv",
      label: "Heart-rate variability",
      score: hrvScore,
      weight: 0.5,
      display: today.hrv ? `${Math.round(today.hrv)} ms` : "—",
      context: hrvContext,
    },
    {
      key: "rhr",
      label: "Resting heart rate",
      score: rhrScore,
      weight: 0.25,
      display: today.rhr ? `${Math.round(today.rhr)} bpm` : "—",
      context: rhrContext,
    },
    {
      key: "sleep",
      label: "Sleep",
      score: sleepScore,
      weight: 0.2,
      display: today.sleepHrs ? fmtHrs(today.sleepHrs) : "—",
      context: `need ${fmtHrs(need)}`,
    },
    {
      key: "resp",
      label: "Respiratory rate",
      score: respScore,
      weight: 0.05,
      display: today.resp ? `${today.resp.toFixed(1)} br/min` : "—",
      context: respContext,
    },
  ];

  const { score, coverage } = weightedScore(components);
  const band = score == null ? "moderate" : bandFor(score);
  return {
    score,
    band,
    label: score == null ? "No data yet" : labelFor(band),
    components,
    coverage,
  };
}

export function fmtHrs(h: number): string {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}
