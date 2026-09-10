import { describe, it, expect } from "vitest";
import {
  stats,
  rollingBaseline,
  zScore,
  zToScore,
  weightedScore,
} from "../src/lib/metrics/baseline";
import { recovery } from "../src/lib/metrics/recovery";
import { strain } from "../src/lib/metrics/strain";
import { sleep, sleepDebt, sleepConsistency } from "../src/lib/metrics/sleep";
import { fitnessAge, estimateVo2max, activityRating } from "../src/lib/metrics/fitnessAge";
import { estimateHrMax, bandFor, type DailyHealth } from "../src/lib/metrics/types";

/** n days of history ending the day before `2026-02-01`. */
function hist(n: number, make: (i: number) => Partial<DailyHealth>): DailyHealth[] {
  const out: DailyHealth[] = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(2026, 1, 1);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ date: key, ...make(i) });
  }
  return out;
}

describe("baseline helpers", () => {
  it("stats computes mean and sample SD", () => {
    const s = stats([2, 4, 4, 4, 5, 5, 7, 9])!;
    expect(s.mean).toBe(5);
    expect(s.sd).toBeCloseTo(2.138, 2);
    expect(s.n).toBe(8);
  });

  it("stats returns null for empty input and sd 0 for one value", () => {
    expect(stats([])).toBeNull();
    expect(stats([7])).toEqual({ mean: 7, sd: 0, n: 1 });
  });

  it("rollingBaseline excludes the target day and needs a minimum sample", () => {
    const h = hist(10, () => ({ rhr: 60 }));
    const b = rollingBaseline(h, "2026-02-01", (d) => d.rhr)!;
    expect(b.n).toBe(10);
    expect(b.mean).toBe(60);
    // Days on/after `upTo` are excluded.
    const withToday = [...h, { date: "2026-02-01", rhr: 200 }];
    expect(rollingBaseline(withToday, "2026-02-01", (d) => d.rhr)!.mean).toBe(60);
    // Too little history → null.
    expect(
      rollingBaseline(
        hist(2, () => ({ rhr: 60 })),
        "2026-02-01",
        (d) => d.rhr,
      ),
    ).toBeNull();
  });

  it("zScore and zToScore map deviations onto 0..1", () => {
    const b = { mean: 50, sd: 10, n: 30 };
    expect(zScore(60, b)).toBe(1);
    expect(zToScore(1, -1.5, 1)).toBe(1);
    expect(zToScore(-1.5, -1.5, 1)).toBe(0);
    expect(zToScore(-0.25, -1.5, 1)).toBeCloseTo(0.5, 5);
  });

  it("weightedScore re-weights around missing components", () => {
    expect(
      weightedScore([
        { score: 1, weight: 0.5 },
        { score: null, weight: 0.5 },
      ]),
    ).toEqual({
      score: 100,
      coverage: 0.5,
    });
    expect(weightedScore([{ score: null, weight: 1 }])).toEqual({ score: null, coverage: 0 });
    expect(
      weightedScore([
        { score: 1, weight: 0.5 },
        { score: 0, weight: 0.5 },
      ]).score,
    ).toBe(50);
  });
});

describe("recovery", () => {
  const history = hist(30, () => ({ hrv: 60, rhr: 55, resp: 14, sleepHrs: 7.5 }));

  it("scores high when HRV is up and resting HR is down", () => {
    const r = recovery({ date: "2026-02-01", hrv: 75, rhr: 50, resp: 14, sleepHrs: 8 }, history);
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThan(80);
    expect(r.coverage).toBeCloseTo(1, 5);
  });

  it("scores low when HRV collapses and resting HR spikes", () => {
    const r = recovery({ date: "2026-02-01", hrv: 35, rhr: 68, resp: 18, sleepHrs: 4 }, history);
    expect(r.score!).toBeLessThan(35);
    expect(r.band).toBe("low");
  });

  it("re-weights when HRV is missing rather than assuming a value", () => {
    const r = recovery({ date: "2026-02-01", rhr: 55, sleepHrs: 8 }, history);
    expect(r.components.find((c) => c.key === "hrv")!.score).toBeNull();
    expect(r.coverage).toBeCloseTo(0.45, 5); // rhr .25 + sleep .20
    expect(r.score).not.toBeNull();
  });

  it("returns null with no usable data at all", () => {
    const r = recovery({ date: "2026-02-01" }, []);
    expect(r.score).toBeNull();
    expect(r.label).toBe("No data yet");
  });

  it("bands map as documented", () => {
    expect(bandFor(90)).toBe("peak");
    expect(bandFor(70)).toBe("good");
    expect(bandFor(50)).toBe("moderate");
    expect(bandFor(20)).toBe("low");
  });
});

describe("strain (Banister TRIMP → 0–21)", () => {
  it("estimateHrMax uses Tanaka when no measured value", () => {
    expect(estimateHrMax({ age: 30 })).toBe(187);
    expect(estimateHrMax({ age: 30, hrMax: 195 })).toBe(195);
  });

  it("a rest day is zero", () => {
    const s = strain({ date: "2026-02-01", rhr: 60 }, { age: 30 });
    expect(s.strain).toBe(0);
    expect(s.source).toBe("none");
  });

  it("does not accumulate strain from simply being awake", () => {
    // A whole day hovering just above resting HR is daily living, not training.
    const idle = Array.from({ length: 24 }, () => ({ avg: 76, min: 70, max: 84 }));
    const s = strain({ date: "2026-02-01", rhr: 54, hrSeries: idle }, { age: 22, sex: "male" });
    expect(s.strain).toBe(0);
    expect(s.zoneMins!.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("computes from the hourly HR series and rises with effort", () => {
    const flat = (v: number) =>
      Array.from({ length: 24 }, () => ({ avg: v, min: v - 2, max: v + 2 }));
    const easy = strain(
      { date: "2026-02-01", rhr: 60, hrSeries: flat(70) },
      { age: 30, sex: "male" },
    );
    const hard = strain(
      { date: "2026-02-01", rhr: 60, hrSeries: flat(120) },
      { age: 30, sex: "male" },
    );
    expect(easy.source).toBe("hr");
    expect(hard.strain).toBeGreaterThan(easy.strain);
    expect(hard.strain).toBeLessThanOrEqual(21);
    expect(hard.zoneMins!.reduce((a, b) => a + b, 0)).toBe(24 * 60);
  });

  it("is calibrated so TRIMP 150 lands near 14", () => {
    // Drive the fallback path with a known input: azm*1.8 = 150 → azm ≈ 83.3
    const s = strain({ date: "2026-02-01", azm: 150 / 1.8 }, { age: 30 });
    expect(s.trimp).toBe(150);
    expect(s.strain).toBeCloseTo(14, 1);
  });

  it("falls back to zone minutes and steps without an HR series", () => {
    const s = strain({ date: "2026-02-01", azm: 30, steps: 12000 }, { age: 30 });
    expect(s.source).toBe("estimated");
    expect(s.strain).toBeGreaterThan(0);
  });
});

describe("sleep", () => {
  it("debt accumulates from shortfalls and decays", () => {
    const short = hist(5, () => ({ sleepHrs: 6 })); // 2h short each night
    const d = sleepDebt(short, "2026-02-01", 8);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(10); // decay keeps it below the naive 10h
    expect(
      sleepDebt(
        hist(5, () => ({ sleepHrs: 9 })),
        "2026-02-01",
        8,
      ),
    ).toBe(0);
  });

  it("need grows with outstanding debt and with a hard day", () => {
    const rested = hist(10, () => ({ sleepHrs: 8 }));
    const tired = hist(10, () => ({ sleepHrs: 5.5 }));
    const a = sleep({ date: "2026-02-01", sleepHrs: 8 }, rested, {}, 0);
    const b = sleep({ date: "2026-02-01", sleepHrs: 8 }, tired, {}, 0);
    const c = sleep({ date: "2026-02-01", sleepHrs: 8 }, rested, {}, 21);
    expect(a.needHrs).toBe(8);
    expect(b.needHrs).toBeGreaterThan(a.needHrs);
    expect(c.needHrs).toBeCloseTo(8.8, 1);
  });

  it("caps the debt top-up so 'need' stays achievable", () => {
    // Two weeks of 4-hour nights builds a large debt; need must still be sane.
    const wrecked = hist(14, () => ({ sleepHrs: 4 }));
    const s = sleep({ date: "2026-02-01", sleepHrs: 7 }, wrecked, {}, 0);
    expect(s.debtHrs).toBeGreaterThan(8); // debt is large and stays visible
    expect(s.needHrs).toBe(9); // base 8 + capped 1
  });

  it("performance is actual over need, and reports no data cleanly", () => {
    const rested = hist(10, () => ({ sleepHrs: 8 }));
    expect(sleep({ date: "2026-02-01", sleepHrs: 8 }, rested).performance).toBe(1);
    expect(sleep({ date: "2026-02-01", sleepHrs: 4 }, rested).performance).toBeCloseTo(0.5, 5);
    const none = sleep({ date: "2026-02-01" }, rested);
    expect(none.performance).toBeNull();
    expect(none.label).toBe("No sleep data");
  });

  it("consistency handles bedtimes either side of midnight", () => {
    const steady = hist(10, () => ({ sleepStart: "23:00" }));
    const chaotic = hist(10, (i) => ({ sleepStart: i % 2 ? "21:30" : "03:30" }));
    const s = sleepConsistency(steady, "2026-02-01");
    const c = sleepConsistency(chaotic, "2026-02-01");
    expect(s.sdMins).toBe(0);
    expect(s.score).toBe(1);
    expect(c.score!).toBeLessThan(0.3);
    // 23:00 and 00:30 must read as 90 minutes apart, not 22.5 hours.
    const wrap = sleepConsistency(
      hist(4, (i) => ({ sleepStart: i % 2 ? "23:00" : "00:30" })),
      "2026-02-01",
    );
    expect(wrap.sdMins!).toBeLessThan(120);
  });
});

describe("fitness age", () => {
  it("prefers a device VO2max over the regression", () => {
    const v = estimateVo2max({ date: "2026-02-01", vo2max: 48 }, [], {
      age: 30,
      sex: "male",
      weightKg: 80,
      heightCm: 180,
    });
    expect(v).toMatchObject({ vo2max: 48, source: "device" });
  });

  it("falls back to the Jackson non-exercise regression", () => {
    const v = estimateVo2max({ date: "2026-02-01" }, [], {
      age: 30,
      sex: "male",
      weightKg: 80,
      heightCm: 180,
      activityRating: 4,
    });
    expect(v.source).toBe("estimated");
    // 56.363 + 1.921*4 − 0.381*30 − 0.754*24.69 + 10.987 ≈ 45.0
    expect(v.vo2max!).toBeCloseTo(45.0, 0);
  });

  it("inverts the HUNT norms — a male VO2max of 50 reads as about 21", () => {
    const r = fitnessAge({ date: "2026-02-01", vo2max: 50 }, [], { age: 30, sex: "male" });
    expect(r.fitnessAge).toBe(21);
    expect(r.delta).toBe(-9);
    expect(r.label).toContain("younger");
  });

  it("a poor VO2max reads older than chronological age", () => {
    const r = fitnessAge({ date: "2026-02-01", vo2max: 30 }, [], { age: 30, sex: "male" });
    expect(r.fitnessAge!).toBeGreaterThan(30);
    expect(r.delta!).toBeGreaterThan(0);
    expect(r.label).toContain("older");
  });

  it("reports honestly when there is nothing to work with", () => {
    const r = fitnessAge({ date: "2026-02-01" }, [], {});
    expect(r.fitnessAge).toBeNull();
    expect(r.vo2Source).toBe("none");
  });

  it("derives an activity rating from logged steps and workouts", () => {
    const lazy = hist(28, () => ({ steps: 2000 }));
    const active = hist(28, () => ({ steps: 13000, workoutMins: 45 }));
    expect(activityRating(lazy, "2026-02-01")).toBeLessThan(1.5);
    expect(activityRating(active, "2026-02-01")).toBe(7);
  });
});
