import { describe, it, expect, beforeEach } from "vitest";
import {
  computeStreak,
  loadState,
  reducer,
  saveState,
  XP_PERFECT_DAY,
  XP_PER_HABIT,
  XP_PER_SESSION,
  type Action,
} from "../src/state/store";
import {
  emptyState,
  isPerfectDay,
  LEGACY_KEY,
  STORAGE_KEY,
  type AppState,
} from "../src/state/schema";
import type { GymSession } from "../src/lib/training";

beforeEach(() => localStorage.clear());

/** A state with a single required habit, so perfect days are easy to reason about. */
function oneHabitState(done: Record<string, Record<string, boolean>> = {}): AppState {
  return {
    ...emptyState(),
    habits: [{ id: "h1", name: "Move" }],
    done,
  };
}

const V2_BLOB = {
  xp: 500,
  streak: 4,
  bestStreak: 9,
  lastDay: "2026-03-04",
  done: { h: true },
  habits: [{ id: "h", label: "Move" }],
  prayers: [],
};

describe("loading", () => {
  it("starts fresh when there is nothing stored", () => {
    const { state, source } = loadState();
    expect(source).toBe("new");
    expect(state.xp).toBe(0);
    expect(state.onboarded).toBe(false);
  });

  it("migrates a v2 blob when there is no v3 yet", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(V2_BLOB));
    const { state, source } = loadState();
    expect(source).toBe("v2");
    expect(state.xp).toBe(500);
    expect(state.migratedFrom).toBe("v2");
  });

  it("prefers an existing v3 state over the legacy blob", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(V2_BLOB));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyState(), xp: 42 }));
    const { state, source } = loadState();
    expect(source).toBe("v3");
    expect(state.xp).toBe(42);
  });

  it("never writes to or removes the legacy blob", () => {
    const raw = JSON.stringify(V2_BLOB);
    localStorage.setItem(LEGACY_KEY, raw);
    loadState();
    saveState(oneHabitState());
    expect(localStorage.getItem(LEGACY_KEY)).toBe(raw);
  });

  it("falls back rather than throwing on corrupt stored data", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    localStorage.setItem(LEGACY_KEY, "{also broken");
    expect(loadState().source).toBe("new");
  });
});

describe("saving", () => {
  it("round-trips through localStorage", () => {
    const s = { ...oneHabitState(), xp: 123 };
    expect(saveState(s)).toBe(true);
    expect(loadState().state.xp).toBe(123);
  });

  it("reports failure instead of losing data silently", () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    try {
      expect(saveState(oneHabitState())).toBe(false);
    } finally {
      Storage.prototype.setItem = orig;
    }
  });
});

describe("streaks", () => {
  it("counts consecutive perfect days", () => {
    const s = oneHabitState({
      "2026-03-01": { h1: true },
      "2026-03-02": { h1: true },
      "2026-03-03": { h1: true },
    });
    // Today is not done yet — yesterday still anchors the streak.
    expect(computeStreak(s, "2026-03-04")).toBe(3);
  });

  it("includes today once it is perfect", () => {
    const s = oneHabitState({
      "2026-03-03": { h1: true },
      "2026-03-04": { h1: true },
    });
    expect(computeStreak(s, "2026-03-04")).toBe(2);
  });

  it("breaks on a gap", () => {
    const s = oneHabitState({
      "2026-03-01": { h1: true },
      "2026-03-03": { h1: true },
    });
    expect(computeStreak(s, "2026-03-04")).toBe(1);
  });

  it("is zero with nothing logged", () => {
    expect(computeStreak(oneHabitState(), "2026-03-04")).toBe(0);
  });

  it("bonus habits do not block a perfect day", () => {
    const s: AppState = {
      ...emptyState(),
      habits: [
        { id: "h1", name: "Move" },
        { id: "b1", name: "Read", bonus: true },
      ],
      done: { "2026-03-04": { h1: true } },
    };
    expect(isPerfectDay(s, "2026-03-04")).toBe(true);
  });
});

describe("reducer", () => {
  const act = (s: AppState, a: Action) => reducer(s, a);

  it("toggling a habit awards XP and toggling back removes it", () => {
    const s0 = oneHabitState();
    const s1 = act(s0, { type: "toggleHabit", date: "2026-03-04", habitId: "h1" });
    // One habit, so completing it is also a perfect day.
    expect(s1.xp).toBe(XP_PER_HABIT + XP_PERFECT_DAY);
    expect(s1.done["2026-03-04"]).toEqual({ h1: true });

    const s2 = act(s1, { type: "toggleHabit", date: "2026-03-04", habitId: "h1" });
    expect(s2.xp).toBe(0);
    expect(s2.done["2026-03-04"]).toEqual({});
  });

  it("never drives XP negative", () => {
    const s = act(oneHabitState({ "2026-03-04": { h1: true } }), {
      type: "toggleHabit",
      date: "2026-03-04",
      habitId: "h1",
    });
    expect(s.xp).toBe(0);
  });

  it("updates the streak and the best streak on completion", () => {
    const s0 = oneHabitState({ "2026-03-03": { h1: true } });
    const s1 = act(s0, { type: "toggleHabit", date: "2026-03-04", habitId: "h1" });
    expect(s1.streak).toMatchObject({ current: 2, best: 2, lastDay: "2026-03-04" });
  });

  it("keeps the best streak once set", () => {
    const s0 = { ...oneHabitState(), streak: { current: 0, best: 30, lastDay: null } };
    const s1 = act(s0, { type: "toggleHabit", date: "2026-03-04", habitId: "h1" });
    expect(s1.streak.best).toBe(30);
  });

  it("adds and removes sessions, keeping them in date order", () => {
    const mk = (date: string, id: string): GymSession => ({
      id,
      date,
      activityId: "gym",
      kind: "gym",
      exerciseId: "ex",
      name: "Bench",
      metric: "weight",
      sets: [{ reps: 5, weight: 60 }],
    });
    let s = act(oneHabitState(), { type: "addSession", session: mk("2026-03-05", "b") });
    s = act(s, { type: "addSession", session: mk("2026-03-02", "a") });
    expect(s.sessions.map((x) => x.id)).toEqual(["a", "b"]);
    expect(s.xp).toBe(XP_PER_SESSION * 2);

    s = act(s, { type: "removeSession", id: "a" });
    expect(s.sessions.map((x) => x.id)).toEqual(["b"]);
    expect(s.xp).toBe(XP_PER_SESSION);
  });

  it("logs replace the entry for the same day rather than piling up", () => {
    let s = act(oneHabitState(), { type: "addWeight", date: "2026-03-04", kg: 96 });
    s = act(s, { type: "addWeight", date: "2026-03-04", kg: 95.5 });
    s = act(s, { type: "addWeight", date: "2026-03-01", kg: 97 });
    expect(s.weight).toEqual([
      { date: "2026-03-01", kg: 97 },
      { date: "2026-03-04", kg: 95.5 },
    ]);
  });

  it("stores profile patches, theme, onboarding and notes", () => {
    let s = act(oneHabitState(), { type: "setProfile", patch: { age: 22 } });
    s = act(s, { type: "setProfile", patch: { heightCm: 178 } });
    expect(s.profile).toMatchObject({ age: 22, heightCm: 178, sleepNeedHrs: 8 });

    s = act(s, { type: "setTheme", themeId: "aurora" });
    expect(s.themeId).toBe("aurora");

    s = act(s, { type: "completeOnboarding" });
    expect(s.onboarded).toBe(true);

    s = act(s, { type: "setNote", date: "2026-03-04", note: { text: "Good day", mood: "strong" } });
    expect(s.notes["2026-03-04"]).toEqual({ text: "Good day", mood: "strong" });
  });
});
