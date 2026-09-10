/**
 * Rolling baselines.
 *
 * Readiness-style scores compare *today* against *your own* recent normal rather
 * than against population numbers — that is the whole point of HRV-guided
 * readiness (Plews et al., "Training adaptation and heart rate variability in
 * elite endurance athletes"). These helpers build that personal baseline.
 */

export interface Baseline {
  mean: number;
  sd: number;
  n: number;
}

/** Mean + (sample) standard deviation of the finite numbers in `values`. */
export function stats(values: number[]): Baseline | null {
  const v = values.filter((x) => typeof x === "number" && isFinite(x));
  if (!v.length) return null;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  if (v.length < 2) return { mean, sd: 0, n: v.length };
  const variance = v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1);
  return { mean, sd: Math.sqrt(variance), n: v.length };
}

/**
 * Baseline over the most recent `window` days *before* `upTo` (exclusive), using
 * `pick` to read the value out of each day. Returns null when there is not
 * enough history to be meaningful (`minN`, default 3).
 */
export function rollingBaseline<T extends { date: string }>(
  history: T[],
  upTo: string,
  pick: (d: T) => number | undefined,
  window = 30,
  minN = 3,
): Baseline | null {
  const vals = history
    .filter((d) => d.date < upTo)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-window)
    .map(pick)
    .filter((x): x is number => typeof x === "number" && isFinite(x) && x > 0);
  const s = stats(vals);
  if (!s || s.n < minN) return null;
  return s;
}

/**
 * Guard against a degenerate spread.
 *
 * A very consistent sleeper can produce a baseline SD near zero, which would
 * make every z-score 0 and pin the score to the middle forever. Floor the SD at
 * a fraction of the mean so the metric stays responsive.
 */
export function withSdFloor(base: Baseline, fraction: number): Baseline {
  const floor = Math.abs(base.mean) * fraction;
  return base.sd >= floor ? base : { ...base, sd: floor };
}

/** How many standard deviations `value` sits from the baseline mean. */
export function zScore(value: number, base: Baseline): number {
  if (!base.sd) return 0;
  return (value - base.mean) / base.sd;
}

/** Map a z-score to 0..1, where `lo` z scores to 0 and `hi` z scores to 1. */
export function zToScore(z: number, lo: number, hi: number): number {
  if (hi === lo) return 0.5;
  return clamp01((z - lo) / (hi - lo));
}

export function clamp01(x: number): number {
  if (!isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Blend components by weight, ignoring the ones with no data. */
export function weightedScore(parts: { score: number | null; weight: number }[]): {
  score: number | null;
  coverage: number;
} {
  let tw = 0;
  let sum = 0;
  for (const p of parts) {
    if (p.score == null) continue;
    tw += p.weight;
    sum += p.score * p.weight;
  }
  if (tw === 0) return { score: null, coverage: 0 };
  return { score: Math.round((sum / tw) * 100), coverage: tw };
}
