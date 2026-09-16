import { describe, it, expect } from "vitest";
import {
  badgesFor,
  dailyChallenges,
  fullPrayerDayCount,
  perfectDayCount,
  realPrCount,
  sortBadges,
  trainingDayCount,
  trainingStreak,
  weeklyChallenges,
} from "../src/lib/achievements";
import { emptyState, type AppState } from "../src/state/schema";
import type { Exercise, Session } from "../src/lib/training";

const MON = "2026-03-02";
const WED = "2026-03-04";
const ALL = { fajr: true, duhr: true, asr: true, maghrib: true, isha: true };

function stateWith(patch: Partial<AppState> = {}): AppState {
  return { ...emptyState(), habits: [{ id: "h1", name: "Move" }], ...patch };
}

const session = (date: string, id: string): Session => ({
  id,
  date,
  activityId: "run",
  kind: "cardio",
  minutes: 30,
});

describe("counting", () => {
  it("counts only days where every required habit was done", () => {
    const s = stateWith({
      habits: [
        { id: "h1", name: "Move" },
        { id: "h2", name: "Read" },
      ],
      done: {
        [MON]: { h1: true, h2: true },
        "2026-03-03": { h1: true },
      },
    });
    expect(perfectDayCount(s)).toBe(1);
  });

  it("counts a day of training once however many sessions it holds", () => {
    const s = stateWith({ sessions: [session(MON, "a"), session(MON, "b"), session(WED, "c")] });
    expect(trainingDayCount(s)).toBe(2);
    expect(fullPrayerDayCount(stateWith({ prayers: { done: { [MON]: ALL }, debt: {} } }))).toBe(1);
  });

  it("does not count a first-ever entry as a record beaten", () => {
    const first: Exercise = {
      id: "ex1",
      name: "Back squat",
      metric: "weight",
      pr: { weight: 110, reps: 3, date: MON },
      history: { [MON]: [{ reps: 3, weight: 110 }] },
    };
    const beaten: Exercise = {
      id: "ex2",
      name: "Bench",
      metric: "weight",
      pr: { weight: 85, reps: 3, date: WED },
      history: {
        [MON]: [{ reps: 5, weight: 80 }],
        [WED]: [{ reps: 3, weight: 85 }],
      },
    };
    expect(realPrCount([first])).toBe(0);
    expect(realPrCount([first, beaten])).toBe(1);
  });
});

describe("badges", () => {
  it("earns on reaching the mark and reports progress before it", () => {
    const s = stateWith({ streak: { current: 9, best: 9, lastDay: WED } });
    const list = badgesFor(s);
    expect(list.find((b) => b.id === "streak7")).toMatchObject({ earned: true, have: 7, need: 7 });
    expect(list.find((b) => b.id === "streak30")).toMatchObject({
      earned: false,
      have: 9,
      need: 30,
    });
  });

  it("caps `have` at the requirement so a bar cannot overflow", () => {
    const s = stateWith({ streak: { current: 400, best: 400, lastDay: WED } });
    expect(badgesFor(s).find((b) => b.id === "streak7")?.have).toBe(7);
  });

  it("hides the prayer badges unless the section is on", () => {
    expect(badgesFor(stateWith()).some((b) => b.id.startsWith("pray"))).toBe(false);
    expect(badgesFor(stateWith({ modules: { prayers: true } })).some((b) => b.id === "pray1")).toBe(
      true,
    );
  });

  it("only awards a cleared debt when there was a debt to clear", () => {
    const never = stateWith({ modules: { prayers: true } });
    expect(never.prayers.debt).toEqual({});
    expect(badgesFor(never).find((b) => b.id === "debt0")?.earned).toBe(false);

    const paid = stateWith({
      modules: { prayers: true },
      prayers: { done: {}, debt: { fajr: 0 } },
    });
    expect(badgesFor(paid).find((b) => b.id === "debt0")?.earned).toBe(true);
  });

  it("sorts earned first, then by how close the rest are", () => {
    const s = stateWith({
      streak: { current: 9, best: 9, lastDay: WED },
      sessions: [session(MON, "a")],
    });
    const sorted = sortBadges(badgesFor(s));
    expect(sorted[0].earned).toBe(true);
    const unearned = sorted.filter((b) => !b.earned);
    for (let i = 1; i < unearned.length; i++) {
      const prev = unearned[i - 1];
      const cur = unearned[i];
      expect(prev.have / prev.need).toBeGreaterThanOrEqual(cur.have / cur.need);
    }
  });
});

describe("daily challenges", () => {
  it("tracks habits, training and nothing that cannot be measured", () => {
    const s = stateWith({ done: { [WED]: { h1: true } }, sessions: [session(WED, "a")] });
    const c = dailyChallenges(s, WED);
    expect(c.find((x) => x.id === "habits")).toMatchObject({ done: true, have: 1, need: 1 });
    expect(c.find((x) => x.id === "train")?.done).toBe(true);
    // No water target set, so no water challenge is offered.
    expect(c.find((x) => x.id === "water")).toBeUndefined();
    expect(c.find((x) => x.id === "prayers")).toBeUndefined();
  });

  it("offers the water challenge once a target exists", () => {
    const s = stateWith({
      profile: { ...emptyState().profile, waterTargetMl: 3000 },
      water: [{ date: WED, ml: 3000 }],
    });
    expect(dailyChallenges(s, WED).find((x) => x.id === "water")?.done).toBe(true);
  });

  it("bonus habits do not stop the habits challenge completing", () => {
    const s = stateWith({
      habits: [
        { id: "h1", name: "Move" },
        { id: "b1", name: "Read", bonus: true },
      ],
      done: { [WED]: { h1: true } },
    });
    expect(dailyChallenges(s, WED).find((x) => x.id === "habits")?.done).toBe(true);
  });
});

describe("weekly challenges", () => {
  it("measures over the days of the week so far", () => {
    const s = stateWith({
      done: { [MON]: { h1: true }, "2026-03-03": { h1: true }, [WED]: { h1: true } },
      sessions: [session(MON, "a"), session(WED, "b")],
    });
    const c = weeklyChallenges(s, WED);
    expect(c.find((x) => x.id === "w_perfect")).toMatchObject({ have: 3, need: 5, done: false });
    expect(c.find((x) => x.id === "w_train")).toMatchObject({ have: 2, need: 4 });
  });

  it("leaves sleep out until a night is recorded", () => {
    expect(weeklyChallenges(stateWith(), WED).find((x) => x.id === "w_sleep")).toBeUndefined();
    const s = stateWith({ health: { [MON]: { date: MON, sleepHrs: 8 } } });
    expect(weeklyChallenges(s, WED).find((x) => x.id === "w_sleep")).toBeDefined();
  });
});

describe("trainingStreak", () => {
  it("counts back from today, and does not break while today is open", () => {
    const s = stateWith({ sessions: [session("2026-03-03", "a"), session(MON, "b")] });
    expect(trainingStreak(s, WED)).toBe(2);
    expect(trainingStreak(s, "2026-03-03")).toBe(2);
  });

  it("is zero with nothing logged", () => {
    expect(trainingStreak(stateWith(), WED)).toBe(0);
  });
});
