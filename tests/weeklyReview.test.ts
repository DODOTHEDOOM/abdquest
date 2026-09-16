import { describe, it, expect } from "vitest";
import { daysOfWeek, weeklyReview, recentWeeks, TRAINING_TARGET } from "../src/lib/weeklyReview";
import { emptyState, type AppState } from "../src/state/schema";
import type { Session } from "../src/lib/training";

/** 2026-03-02 is a Monday; 2026-03-04 is the Wednesday of that week. */
const MON = "2026-03-02";
const WED = "2026-03-04";

function stateWith(patch: Partial<AppState> = {}): AppState {
  return {
    ...emptyState(),
    habits: [{ id: "h1", name: "Move" }],
    ...patch,
  };
}

const allDone = (dates: string[]) =>
  Object.fromEntries(dates.map((d) => [d, { h1: true }])) as AppState["done"];

const session = (date: string, id: string): Session => ({
  id,
  date,
  activityId: "run",
  kind: "cardio",
  minutes: 30,
});

describe("daysOfWeek", () => {
  it("stops at today rather than running to Sunday", () => {
    expect(daysOfWeek(MON, WED)).toEqual([MON, "2026-03-03", WED]);
  });

  it("gives the full week once it is over", () => {
    expect(daysOfWeek(MON, "2026-03-20")).toHaveLength(7);
  });
});

describe("a week in progress", () => {
  it("measures against the days that have happened, not a full seven", () => {
    // Mon, Tue and Wed all complete. The old genRC scored this 3/7 = 43% and
    // graded it F. It is a perfect week so far.
    const s = stateWith({ done: allDone([MON, "2026-03-03", WED]) });
    const r = weeklyReview(s, WED);
    const habits = r.parts.find((p) => p.key === "habits");
    expect(habits).toMatchObject({ hit: 3, of: 3 });
    // Nothing else is being tracked, so a perfect habits week is a perfect week.
    expect(r.score).toBe(100);
    expect(r.label).toBe("Outstanding week");
    expect(r.complete).toBe(false);
    expect(r.daysElapsed).toBe(3);
  });

  it("pro-rates the training target instead of demanding a full week's worth", () => {
    // Four sessions a week; by Wednesday that is two, and two were done.
    const s = stateWith({
      sessions: [session(MON, "a"), session("2026-03-03", "b")],
    });
    const training = weeklyReview(s, WED).parts.find((p) => p.key === "training");
    expect(training).toMatchObject({ hit: 2, of: 2 });
  });

  it("counts two sessions on one day as one day of training", () => {
    const s = stateWith({ sessions: [session(MON, "a"), session(MON, "b")] });
    const training = weeklyReview(s, MON).parts.find((p) => p.key === "training");
    expect(training?.hit).toBe(1);
  });

  it("marks a finished week complete", () => {
    const r = weeklyReview(stateWith({ done: allDone([MON]) }), "2026-03-20", MON);
    expect(r.complete).toBe(true);
    expect(r.daysElapsed).toBe(7);
  });
});

describe("only what is actually tracked counts", () => {
  it("leaves water out entirely when no target is set", () => {
    const s = stateWith({ water: [{ date: MON, ml: 500 }] });
    expect(weeklyReview(s, WED).parts.find((p) => p.key === "water")).toBeUndefined();
  });

  it("includes water once a target exists, scored over the days logged", () => {
    const s = stateWith({
      profile: { ...emptyState().profile, waterTargetMl: 3000 },
      water: [
        { date: MON, ml: 3200 },
        { date: "2026-03-03", ml: 1000 },
      ],
    });
    expect(weeklyReview(s, WED).parts.find((p) => p.key === "water")).toMatchObject({
      hit: 1,
      of: 2,
    });
  });

  it("does not punish nights that were never recorded", () => {
    const s = stateWith({
      health: { [MON]: { date: MON, sleepHrs: 8 } },
    });
    // One night on file, one good night — not one of three.
    expect(weeklyReview(s, WED).parts.find((p) => p.key === "sleep")).toMatchObject({
      hit: 1,
      of: 1,
    });
  });

  it("drops prayers unless the section is switched on", () => {
    const off = weeklyReview(stateWith(), WED);
    expect(off.parts.find((p) => p.key === "prayers")).toBeUndefined();

    const on = weeklyReview(stateWith({ modules: { prayers: true } }), WED);
    expect(on.parts.find((p) => p.key === "prayers")).toBeDefined();
  });

  it("re-weights so a missing component does not drag the score down", () => {
    const s = stateWith({ done: allDone([MON, "2026-03-03", WED]) });
    const r = weeklyReview(s, WED);
    // Habits is the only thing this person tracks, so it carries the whole score.
    expect(r.parts.map((p) => p.key)).toEqual(["habits"]);
    expect(r.coverage).toBeCloseTo(0.3, 5);
  });

  it("leaves training out for someone who has never logged a session", () => {
    const s = stateWith({ done: allDone([MON]) });
    expect(weeklyReview(s, WED).parts.find((p) => p.key === "training")).toBeUndefined();
  });

  it("scores a blank week as zero for someone who does train", () => {
    // Trained three weeks ago, nothing this week — that is a real zero.
    const s = stateWith({ sessions: [session("2026-02-10", "old")] });
    const training = weeklyReview(s, WED).parts.find((p) => p.key === "training");
    expect(training).toMatchObject({ hit: 0, of: 2 });
  });
});

describe("an empty week", () => {
  it("scores null, not zero, when there is nothing to measure at all", () => {
    const bare: AppState = { ...emptyState(), habits: [] };
    const r = weeklyReview(bare, WED);
    expect(r.parts).toHaveLength(0);
    expect(r.score).toBeNull();
    expect(r.label).toBe("Nothing tracked yet");
  });
});

describe("recentWeeks", () => {
  it("returns the current week first and stops once history runs out", () => {
    const s = stateWith({ done: allDone([MON, WED]) });
    const weeks = recentWeeks(s, WED, 8);
    expect(weeks[0].weekStart).toBe(MON);
    expect(weeks.length).toBeLessThanOrEqual(8);
  });
});

describe("the training target", () => {
  it("is four sessions a week", () => {
    expect(TRAINING_TARGET).toBe(4);
  });
});
