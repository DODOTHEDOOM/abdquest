import { describe, it, expect } from "vitest";
import {
  MILESTONES,
  momentum,
  motivation,
  nextMilestone,
  justHitMilestone,
  type MotivationContext,
} from "../src/lib/motivation";

const base: MotivationContext = {
  todayKey: "2026-03-04",
  hour: 10,
  streak: 12,
  bestStreak: 15,
  habitsDone: 2,
  habitsTotal: 5,
  recovery: 65,
  trainedToday: false,
  recentPR: null,
  thisWeekSessions: 2,
  lastWeekSessions: 2,
  fitnessAgeDelta: 0,
};

describe("milestones", () => {
  it("are in ascending order", () => {
    const days = MILESTONES.map((m) => m.days);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  it("nextMilestone reports what's left and progress through the gap", () => {
    const n = nextMilestone(12)!;
    expect(n.milestone.days).toBe(14);
    expect(n.remaining).toBe(2);
    expect(n.progress).toBeCloseTo((12 - 10) / (14 - 10), 5);
    expect(nextMilestone(0)!.milestone.days).toBe(3);
    expect(nextMilestone(400)).toBeNull();
  });

  it("justHitMilestone only fires on the exact day", () => {
    expect(justHitMilestone(100)!.title).toBe("Centurion");
    expect(justHitMilestone(99)).toBeNull();
  });
});

describe("momentum", () => {
  it("compares this week against last", () => {
    expect(momentum(6, 4)).toEqual({ pct: 50, direction: "up" });
    expect(momentum(2, 4)).toEqual({ pct: -50, direction: "down" });
    expect(momentum(4, 4)).toEqual({ pct: 0, direction: "flat" });
  });
  it("handles a first week with nothing to compare against", () => {
    expect(momentum(3, 0)).toEqual({ pct: null, direction: "up" });
    expect(momentum(0, 0)).toEqual({ pct: null, direction: "flat" });
  });
});

describe("motivation picks the most important true thing", () => {
  it("celebrates a record set today above everything else", () => {
    const m = motivation({
      ...base,
      habitsDone: 0,
      hour: 20, // streak would otherwise be at risk
      recentPR: {
        exercise: "Bench press",
        kind: "weight",
        previous: 80,
        next: 85,
        date: "2026-03-04",
      },
    });
    expect(m.tone).toBe("celebrate");
    expect(m.headline).toContain("Bench press");
    expect(m.detail).toContain("85kg");
    expect(m.detail).toContain("up 5kg");
  });

  it("phrases a first-ever record as a first record, not a gain over zero", () => {
    const m = motivation({
      ...base,
      recentPR: {
        exercise: "Back squat",
        kind: "weight",
        previous: 0, // nothing logged before today
        next: 110,
        date: "2026-03-04",
      },
    });
    expect(m.tone).toBe("celebrate");
    expect(m.headline).toContain("First record");
    expect(m.detail).toContain("110kg");
    expect(m.detail).not.toContain("up 110kg");
    expect(m.detail).not.toContain("on your best");
  });

  it("ignores a record from a previous day", () => {
    const m = motivation({
      ...base,
      recentPR: {
        exercise: "Bench press",
        kind: "weight",
        previous: 80,
        next: 85,
        date: "2026-03-01",
      },
    });
    expect(m.headline).not.toContain("Bench press");
  });

  it("protects a streak late in the day with nothing logged", () => {
    const m = motivation({ ...base, habitsDone: 0, hour: 18 });
    expect(m.tone).toBe("protect");
    expect(m.headline).toContain("12-day streak");
  });

  it("does not panic early in the morning", () => {
    const m = motivation({ ...base, habitsDone: 0, hour: 8 });
    expect(m.tone).not.toBe("protect");
  });

  it("pushes when a milestone is within three days", () => {
    const m = motivation({ ...base, streak: 12 });
    expect(m.tone).toBe("push");
    expect(m.headline).toBe("2 days to Two Weeks Strong");
  });

  it("pushes to train when recovery is high and you haven't", () => {
    const m = motivation({ ...base, streak: 30, recovery: 88, trainedToday: false });
    expect(m.tone).toBe("push");
    expect(m.headline).toContain("88%");
  });

  it("gives permission to rest when run down", () => {
    const m = motivation({ ...base, streak: 30, recovery: 38 });
    expect(m.tone).toBe("ease");
    expect(m.detail).toContain("light");
  });

  it("celebrates training more than last week", () => {
    const m = motivation({ ...base, streak: 30, thisWeekSessions: 5, lastWeekSessions: 3 });
    expect(m.tone).toBe("celebrate");
    expect(m.headline).toContain("67%");
  });

  it("calls out slipping behind last week", () => {
    const m = motivation({ ...base, streak: 30, thisWeekSessions: 1, lastWeekSessions: 4 });
    expect(m.tone).toBe("push");
    expect(m.headline).toContain("1 v 4");
  });

  it("celebrates a perfect day", () => {
    const m = motivation({
      ...base,
      streak: 30,
      habitsDone: 5,
      habitsTotal: 5,
      thisWeekSessions: 2,
      lastWeekSessions: 2,
    });
    expect(m.tone).toBe("celebrate");
    expect(m.headline).toContain("Perfect day");
  });

  it("always returns something, even with no data at all", () => {
    const m = motivation({
      todayKey: "2026-03-04",
      hour: 9,
      streak: 0,
      bestStreak: 0,
      habitsDone: 0,
      habitsTotal: 0,
      recovery: null,
      trainedToday: false,
      thisWeekSessions: 0,
      lastWeekSessions: 0,
    });
    expect(m.headline.length).toBeGreaterThan(0);
    expect(m.detail.length).toBeGreaterThan(0);
  });
});
