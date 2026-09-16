import { describe, it, expect, beforeEach } from "vitest";
import {
  computeStreak,
  loadState,
  reducer,
  saveState,
  XP_PERFECT_DAY,
  XP_PER_HABIT,
  XP_PER_SESSION,
  XP_PER_PRAYER,
  XP_ALL_PRAYERS,
  XP_PER_DEBT_PRAYER,
  type Action,
} from "../src/state/store";
import {
  emptyState,
  isPerfectDay,
  LEGACY_KEY,
  STORAGE_KEY,
  type AppState,
} from "../src/state/schema";
import type { GymSession, Session } from "../src/lib/training";

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

  it("merging a synced day fills gaps without blanking what is already there", () => {
    let s = act(oneHabitState(), {
      type: "mergeHealth",
      date: "2026-03-04",
      day: { date: "2026-03-04", rhr: 54, hrv: 61, steps: 9000 },
    });
    // A later sync that only managed to read steps must not wipe HRV or RHR.
    s = act(s, {
      type: "mergeHealth",
      date: "2026-03-04",
      day: { date: "2026-03-04", steps: 11200 },
    });
    expect(s.health["2026-03-04"]).toEqual({
      date: "2026-03-04",
      rhr: 54,
      hrv: 61,
      steps: 11200,
    });
  });

  it("re-syncing replaces imported sessions but never hand-logged ones", () => {
    const imported = (id: string, minutes: number): Session => ({
      id,
      date: "2026-03-04",
      activityId: "run",
      kind: "cardio",
      minutes,
      auto: true,
    });
    const byHand: Session = {
      id: "mine",
      date: "2026-03-04",
      activityId: "padel",
      kind: "sport",
      minutes: 90,
    };

    let s = act(oneHabitState(), { type: "addSession", session: byHand });
    s = act(s, {
      type: "syncAutoSessions",
      date: "2026-03-04",
      sessions: [imported("gh_2026-03-04_0730", 30)],
    });
    // Second sync of the same day: the import is refreshed, mine is untouched.
    s = act(s, {
      type: "syncAutoSessions",
      date: "2026-03-04",
      sessions: [imported("gh_2026-03-04_0730", 34)],
    });

    expect(s.sessions).toHaveLength(2);
    expect(s.sessions.find((x) => x.id === "mine")).toEqual(byHand);
    const auto = s.sessions.find((x) => x.id === "gh_2026-03-04_0730");
    expect(auto).toMatchObject({ minutes: 34 });
  });

  it("a sync for one day leaves other days alone", () => {
    let s = act(oneHabitState(), {
      type: "syncAutoSessions",
      date: "2026-03-03",
      sessions: [
        {
          id: "gh_2026-03-03_0800",
          date: "2026-03-03",
          activityId: "walk",
          kind: "cardio",
          minutes: 20,
          auto: true,
        },
      ],
    });
    s = act(s, { type: "syncAutoSessions", date: "2026-03-04", sessions: [] });
    expect(s.sessions.map((x) => x.date)).toEqual(["2026-03-03"]);
  });

  it("awards a bonus for the full five and takes it back if one is undone", () => {
    const ids = ["fajr", "duhr", "asr", "maghrib", "isha"];
    let s = oneHabitState();
    for (const id of ids) s = act(s, { type: "togglePrayer", date: "2026-03-04", prayerId: id });
    expect(s.xp).toBe(XP_PER_PRAYER * 5 + XP_ALL_PRAYERS);

    s = act(s, { type: "togglePrayer", date: "2026-03-04", prayerId: "asr" });
    expect(s.xp).toBe(XP_PER_PRAYER * 4);
    expect(s.prayers.done["2026-03-04"].asr).toBeUndefined();
  });

  it("never repays more prayer debt than is owed", () => {
    let s: AppState = { ...oneHabitState(), prayers: { done: {}, debt: { fajr: 2 } } };
    s = act(s, { type: "payPrayerDebt", prayerId: "fajr", count: 5 });
    expect(s.prayers.debt.fajr).toBe(0);
    expect(s.xp).toBe(XP_PER_DEBT_PRAYER * 2);

    // Nothing owed: no XP, and the state is returned unchanged.
    const after = act(s, { type: "payPrayerDebt", prayerId: "fajr", count: 3 });
    expect(after).toBe(s);
  });

  it("turning a module off hides it without deleting what it recorded", () => {
    const withData: AppState = {
      ...oneHabitState(),
      modules: { prayers: true },
      prayers: { done: { "2026-03-04": { fajr: true } }, debt: { fajr: 4 } },
    };
    const off = act(withData, { type: "setModule", key: "prayers", on: false });
    expect(off.modules.prayers).toBe(false);
    expect(off.prayers).toEqual(withData.prayers);
  });

  it("clearing a journal entry removes it rather than storing an empty one", () => {
    let s = act(oneHabitState(), {
      type: "setNote",
      date: "2026-03-04",
      note: { text: "Rough one", mood: "low" },
    });
    s = act(s, { type: "setNote", date: "2026-03-04", note: { text: "   " } });
    expect(s.notes["2026-03-04"]).toBeUndefined();
  });

  it("keeps an entry that has only a mood", () => {
    const s = act(oneHabitState(), {
      type: "setNote",
      date: "2026-03-04",
      note: { text: "", mood: "tired" },
    });
    expect(s.notes["2026-03-04"]).toEqual({ text: "", mood: "tired" });
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
