import { describe, it, expect } from "vitest";
import {
  averageOf,
  carryForward,
  hoursBetween,
  seriesFor,
  shiftDate,
  targetStreak,
  towardTarget,
  weightTrend,
  type DatedValue,
} from "../src/lib/body";

const v = (date: string, value: number): DatedValue => ({ date, value });

describe("seriesFor", () => {
  it("lines entries up by day, oldest first, with gaps as null", () => {
    const s = seriesFor([v("2026-03-04", 10), v("2026-03-02", 8)], "2026-03-04", 4);
    expect(s).toEqual([null, 8, null, 10]);
  });
});

describe("carryForward", () => {
  it("holds the last reading across gaps instead of dropping to zero", () => {
    expect(carryForward([null, 100, null, null, 98])).toEqual([100, 100, 100, 98]);
  });

  it("starts at the first real reading rather than inventing a history", () => {
    expect(carryForward([null, null, 80])).toEqual([80]);
  });

  it("is empty when nothing was ever logged", () => {
    expect(carryForward([null, null])).toEqual([]);
  });
});

describe("averageOf", () => {
  it("divides by the days with data, not the width of the window", () => {
    // The classic bug: 18/4 = 4.5 instead of 18/2 = 9.
    expect(averageOf([null, 8, null, 10])).toBe(9);
  });

  it("is null for an empty window rather than zero", () => {
    expect(averageOf([])).toBeNull();
    expect(averageOf([null, null])).toBeNull();
  });
});

describe("weightTrend", () => {
  it("reports the latest reading and the raw change", () => {
    const t = weightTrend([v("2026-03-01", 100), v("2026-03-10", 98)], "2026-03-10");
    expect(t.latest).toBe(98);
    expect(t.latestDate).toBe("2026-03-10");
    expect(t.change).toBe(-2);
  });

  it("smooths the trend so one heavy morning does not flip it", () => {
    // Genuinely falling, but the last reading is a spike.
    const entries = [
      v("2026-03-01", 100),
      v("2026-03-02", 99.6),
      v("2026-03-03", 99.2),
      v("2026-03-08", 98.4),
      v("2026-03-09", 98.0),
      v("2026-03-10", 99.4),
    ];
    const t = weightTrend(entries, "2026-03-10");
    // Raw change looks like -0.6; the trend sees the real fall.
    expect(t.change).toBeCloseTo(-0.6, 5);
    expect(t.trend).toBeLessThan(-1);
  });

  it("holds back the trend until there is enough to smooth", () => {
    expect(weightTrend([v("2026-03-01", 100), v("2026-03-02", 99)], "2026-03-02").trend).toBeNull();
  });

  it("is all nulls with nothing logged, never zero", () => {
    expect(weightTrend([], "2026-03-10")).toEqual({
      latest: null,
      latestDate: null,
      change: null,
      trend: null,
      toTarget: null,
    });
  });

  it("ignores readings outside the window", () => {
    const t = weightTrend([v("2025-01-01", 120), v("2026-03-10", 98)], "2026-03-10", 30);
    expect(t.change).toBeNull(); // only one reading is in range
    expect(t.latest).toBe(98);
  });

  it("measures the distance to a target when one is set", () => {
    expect(weightTrend([v("2026-03-10", 98)], "2026-03-10", 30, 90).toTarget).toBe(8);
  });
});

describe("towardTarget", () => {
  it("is a fraction, capped at 1", () => {
    expect(towardTarget(1500, 3000)).toBe(0.5);
    expect(towardTarget(4000, 3000)).toBe(1);
  });

  it("is null with no target, so nothing is assumed for you", () => {
    expect(towardTarget(1500, undefined)).toBeNull();
    expect(towardTarget(1500, 0)).toBeNull();
  });
});

describe("targetStreak", () => {
  const entries = [
    v("2026-03-01", 3000),
    v("2026-03-02", 3200),
    v("2026-03-03", 1000), // missed
    v("2026-03-04", 3000),
    v("2026-03-05", 3100),
  ];

  it("counts days that met the target and the run ending today", () => {
    const s = targetStreak(entries, "2026-03-05", 3000, 7);
    expect(s.hits).toBe(4);
    expect(s.current).toBe(2);
  });

  it("does not break the run while today is still open", () => {
    const s = targetStreak(entries, "2026-03-06", 3000, 7);
    expect(s.current).toBe(2); // yesterday still anchors it
  });

  it("is inert when no target is set", () => {
    expect(targetStreak(entries, "2026-03-05", undefined)).toEqual({
      current: 0,
      hits: 0,
      days: 30,
    });
  });
});

describe("hoursBetween", () => {
  it("crosses midnight", () => {
    expect(hoursBetween("23:15", "06:50")).toBe(7.6);
  });

  it("handles a same-day nap window", () => {
    expect(hoursBetween("13:00", "14:30")).toBe(1.5);
  });

  it("treats identical times as a full day rather than zero", () => {
    expect(hoursBetween("22:00", "22:00")).toBe(24);
  });

  it("rejects nonsense", () => {
    expect(hoursBetween("", "06:00")).toBeNull();
    expect(hoursBetween("25:00", "06:00")).toBeNull();
  });
});

describe("shiftDate", () => {
  it("steps across a month boundary in local time", () => {
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});
