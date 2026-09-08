import { describe, it, expect } from "vitest";
import {
  getPenalty,
  getMissColor,
  getSleepQ,
  MILESTONES,
  ACHV,
  achWkCount,
  achStepBest,
  achWtLost,
  achPrayerDays,
  achPerfectDays,
} from "../src/lib/scoring";

describe("getPenalty", () => {
  it("is zero for zero or negative missed days", () => {
    expect(getPenalty(40, 0)).toBe(0);
    expect(getPenalty(40, -3)).toBe(0);
  });

  it("ramps 20% + 13%/day and caps at the full habit XP", () => {
    expect(getPenalty(100, 1)).toBe(20); // 0.20
    expect(getPenalty(100, 2)).toBe(33); // 0.33
    expect(getPenalty(100, 3)).toBe(46); // 0.46
    expect(getPenalty(100, 7)).toBe(98); // 0.98
    expect(getPenalty(100, 8)).toBe(100); // capped
    expect(getPenalty(100, 50)).toBe(100); // still capped
    expect(getPenalty(25, 1)).toBe(5);
  });
});

describe("getMissColor", () => {
  it("maps missed-day counts to escalating colours", () => {
    expect(getMissColor(0)).toBeNull();
    expect(getMissColor(1)).toBe("#ddaa22");
    expect(getMissColor(2)).toBe("#dd7722");
    expect(getMissColor(3)).toBe("#cc3322");
    expect(getMissColor(4)).toBe("#cc3322");
    expect(getMissColor(5)).toBe("#aa1111");
  });
});

describe("getSleepQ", () => {
  it("bands hours into quality labels", () => {
    expect(getSleepQ(4.9).label).toBe("Bad");
    expect(getSleepQ(5).label).toBe("Average");
    expect(getSleepQ(6.9).label).toBe("Average");
    expect(getSleepQ(7).label).toBe("Good");
    expect(getSleepQ(8.9).label).toBe("Good");
    expect(getSleepQ(9).label).toBe("Excellent");
  });
});

describe("MILESTONES", () => {
  it("covers the expected day thresholds in order", () => {
    expect(MILESTONES.map((m) => m.days)).toEqual([3, 7, 10, 14, 25, 50, 100, 200, 365]);
    for (let i = 1; i < MILESTONES.length; i++) {
      expect(MILESTONES[i].xp).toBeGreaterThan(MILESTONES[i - 1].xp);
    }
  });
});

describe("achievement helpers", () => {
  it("achWkCount sums all workout-session entries across days", () => {
    expect(achWkCount({ workoutSessions: { "2025-01-01": [1, 2], "2025-01-02": [3] } })).toBe(3);
    expect(achWkCount({})).toBe(0);
  });

  it("achStepBest returns the highest single-day step count", () => {
    expect(achStepBest({ stepLog: { a: 4000, b: 12000, c: 9000 } })).toBe(12000);
    expect(achStepBest({})).toBe(0);
  });

  it("achWtLost is start weight minus latest logged weight, floored at 0", () => {
    expect(achWtLost({ startWt: 152, wtLog: [{ wt: 150 }, { wt: 145 }] })).toBe(7);
    expect(achWtLost({ startWt: 140, wtLog: [{ wt: 145 }] })).toBe(0);
    expect(achWtLost({})).toBe(0);
  });

  it("achPrayerDays counts full-5-prayer days in history plus today", () => {
    const all = { fajr: 1, duhr: 1, asr: 1, maghrib: 1, isha: 1 };
    expect(
      achPrayerDays({
        prayerHist: { "2025-01-01": all, "2025-01-02": { ...all, isha: 0 } },
        done: all,
      }),
    ).toBe(2); // one history day + today
  });

  it("achPerfectDays counts log entries where every non-bonus quest is done", () => {
    const habits = [{ id: "h1" }, { id: "h2" }];
    expect(
      achPerfectDays({
        habits,
        prayers: [],
        life: [],
        log: [{ done: { h1: true, h2: true } }, { done: { h1: true } }],
        done: {},
      }),
    ).toBe(1);
  });
});

describe("ACHV table", () => {
  it("has unique ids and every entry is checkable", () => {
    const ids = ACHV.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const empty = { xp: 0, streak: 0, done: {}, habits: [], prayers: [], life: [], log: [] };
    for (const a of ACHV) expect(typeof a.check(empty)).toBe("boolean");
  });

  it("streak + level achievements fire at their thresholds", () => {
    expect(ACHV.find((a) => a.id === "a_st7")!.check({ streak: 7 })).toBe(true);
    expect(ACHV.find((a) => a.id === "a_st7")!.check({ streak: 6 })).toBe(false);
    expect(ACHV.find((a) => a.id === "a_lv5")!.check({ xp: 1000 })).toBe(true);
    expect(ACHV.find((a) => a.id === "a_lv5")!.check({ xp: 999 })).toBe(false);
  });
});
