import { describe, it, expect } from "vitest";
import { looksLikeV2, migrateV2 } from "../src/state/migrate";
import { emptyState, levelFromXp, levelProgress, xpForLevel } from "../src/state/schema";

/** A realistic slice of a real abdquest_v2 blob. */
const V2 = {
  xp: 4200,
  streak: 12,
  bestStreak: 15,
  lastDay: "2026-03-04",
  theme: "crimson",
  startWt: 152,
  done: { nojunk: true, workout: true },
  habits: [
    { id: "nojunk", label: "Zero Junk Food", icon: "🚫", xp: 25, desc: "No crisps or takeaway" },
    { id: "workout", label: "Move Your Body", icon: "⚔️", xp: 40, desc: "Walk, gym, anything" },
  ],
  life: [{ id: "emails", label: "Work Emails", icon: "📧", xp: 15, desc: "Clear the inbox" }],
  bonus: [{ id: "readbook", label: "Read Something", icon: "📖", xp: 20, desc: "Anything" }],
  prayers: [{ id: "fajr", label: "Fajr", icon: "🌅", xp: 30 }],
  log: [
    { date: "2026-03-02", done: { nojunk: true, workout: true, emails: true }, allDone: true },
    { date: "2026-03-03", done: { nojunk: true }, allDone: false },
  ],
  workoutSessions: {
    "2026-03-02": [
      {
        id: "s1",
        type: "gym",
        exId: "ex_bench",
        name: "Bench press",
        metric: "weight",
        sets: [
          { reps: 10, weight: 60 },
          { reps: 5, weight: 75 },
        ],
      },
      { id: "s2", type: "run", duration: 32, distance: 5.2, cal: 410, hr: 148 },
    ],
    "2026-03-04": [
      { id: "s3", type: "fbx", name: "Elliptical", duration: 25, cal: 220, auto: true },
      {
        id: "s4",
        type: "gym",
        exId: "ex_pullup",
        name: "Pull-ups",
        metric: "bodyweight",
        sets: [{ reps: 12, weight: 0 }],
      },
    ],
  },
  stepLog: { "2026-03-02": 11200, "2026-03-04": 9800 },
  sleepLog: [
    { date: "2026-03-02", hrs: 7.4 },
    { date: "2026-03-04", hrs: 6.1 },
  ],
  wtLog: [
    { date: "2026-02-20", wt: 150 },
    { date: "2026-03-01", wt: 148.5 },
  ],
  calLog: [{ date: "2026-03-02", cal: 2100, prot: 150 }],
  waterLog: [{ date: "2026-03-02", ml: 2500 }],
  notes: { "2026-03-02": { text: "Good day", mood: "strong" }, "2026-03-03": { text: "" } },
  fbDaily: {
    "2026-03-04": {
      rhr: 54,
      hrv: 61,
      resp: 14.2,
      spo2: 96,
      vo2max: 45.3,
      hrAvg: 72,
      hrMin: 49,
      hrMax: 164,
      azm: 44,
      calOut: 2800,
      sleepStart: "23:15",
      sleepEnd: "06:50",
      hrSeries: [{ avg: 55, min: 50, max: 60 }, null, { avg: 120, min: 98, max: 150 }],
    },
  },
};

describe("looksLikeV2", () => {
  it("accepts a real blob and rejects anything else", () => {
    expect(looksLikeV2(V2)).toBe(true);
    expect(looksLikeV2({ xp: 1 })).toBe(false);
    expect(looksLikeV2(null)).toBe(false);
    expect(looksLikeV2("nope")).toBe(false);
  });
});

describe("migrateV2", () => {
  const s = migrateV2(V2);

  it("carries streak, best streak and XP across", () => {
    expect(s.streak).toEqual({ current: 12, best: 15, lastDay: "2026-03-04" });
    expect(s.xp).toBe(4200);
    expect(s.migratedFrom).toBe("v2");
    expect(s.version).toBe(3);
  });

  it("merges habits, life quests and bonus quests into one list", () => {
    expect(s.habits.map((h) => h.id)).toEqual(["nojunk", "workout", "emails", "readbook"]);
    expect(s.habits[0]).toMatchObject({ name: "Zero Junk Food", detail: "No crisps or takeaway" });
    // Bonus quests are flagged so they do not break a perfect day.
    expect(s.habits.find((h) => h.id === "readbook")?.bonus).toBe(true);
  });

  it("rebuilds day-by-day completion from the log plus today", () => {
    expect(s.done["2026-03-02"]).toEqual({ nojunk: true, workout: true, emails: true });
    expect(s.done["2026-03-03"]).toEqual({ nojunk: true });
    // `done` belongs to lastDay.
    expect(s.done["2026-03-04"]).toEqual({ nojunk: true, workout: true });
  });

  it("converts gym and cardio sessions, including the watch catch-all", () => {
    expect(s.sessions).toHaveLength(4);
    const bench = s.sessions.find((x) => x.id === "s1");
    expect(bench).toMatchObject({ kind: "gym", name: "Bench press", metric: "weight" });
    const run = s.sessions.find((x) => x.id === "s2");
    expect(run).toMatchObject({ kind: "cardio", activityId: "run", minutes: 32, distanceKm: 5.2 });
    // 'fbx' was the old catch-all for an imported workout.
    expect(s.sessions.find((x) => x.id === "s3")).toMatchObject({
      activityId: "other",
      auto: true,
    });
    expect(s.sessions.find((x) => x.id === "s4")).toMatchObject({ metric: "bodyweight" });
    // Sorted oldest first.
    expect(s.sessions.map((x) => x.date)).toEqual([...s.sessions.map((x) => x.date)].sort());
  });

  it("gathers health readings from fbDaily, stepLog and sleepLog into one day", () => {
    const d = s.health["2026-03-04"];
    expect(d).toMatchObject({
      rhr: 54,
      hrv: 61,
      spo2: 96,
      vo2max: 45.3,
      steps: 9800,
      sleepHrs: 6.1,
    });
    expect(d.hrSeries?.[1]).toBeNull();
    expect(d.hrSeries?.[2]).toMatchObject({ avg: 120 });
    // Training minutes are folded in for the activity rating.
    expect(d.workoutMins).toBe(25 + 3);
  });

  it("carries the tracking logs and drops empty entries", () => {
    expect(s.weight).toHaveLength(2);
    expect(s.calories).toEqual([{ date: "2026-03-02", kcal: 2100, protein: 150 }]);
    expect(s.water).toEqual([{ date: "2026-03-02", ml: 2500 }]);
    expect(Object.keys(s.notes)).toEqual(["2026-03-02"]); // the empty note is skipped
  });

  it("seeds the profile weight from the latest weigh-in", () => {
    expect(s.profile.weightKg).toBe(148.5);
  });

  it("maps the old colourway onto the closest new one", () => {
    expect(s.themeId).toBe("ember");
    expect(migrateV2({ ...V2, theme: "dark" }).themeId).toBe("midnight");
    expect(migrateV2({ ...V2, theme: "wat" }).themeId).toBe("daylight");
  });

  it("treats an existing user as already set up", () => {
    expect(s.onboarded).toBe(true);
  });

  it("survives a blob full of junk without throwing", () => {
    const junk = migrateV2({
      xp: "nope",
      streak: null,
      habits: [{ id: "x" }, null, 42],
      log: "not an array",
      workoutSessions: { notadate: [{ type: "gym" }], "2026-03-02": [{ type: "gym", sets: [] }] },
      stepLog: { "2026-03-02": "lots" },
      wtLog: [{ date: "bad", wt: 10 }],
      fbDaily: { "2026-03-02": { rhr: null, hrSeries: "nope" } },
    });
    expect(junk.xp).toBe(0);
    expect(junk.streak.current).toBe(0);
    expect(junk.sessions).toEqual([]);
    expect(junk.weight).toEqual([]);
    expect(junk.habits).toEqual(emptyState().habits); // fell back to defaults
  });
});

describe("levels", () => {
  it("xpForLevel follows 50n(n-1)", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(5)).toBe(1000);
    expect(xpForLevel(10)).toBe(4500);
    expect(xpForLevel(20)).toBe(19000);
  });

  it("levelFromXp inverts it", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(4200)).toBe(9);
    expect(levelFromXp(19000)).toBe(20);
  });

  it("levelProgress reports the way through the current level", () => {
    const p = levelProgress(150);
    expect(p.level).toBe(2);
    expect(p.into).toBe(50);
    expect(p.need).toBe(200); // level 3 at 300
    expect(p.pct).toBeCloseTo(0.25, 5);
    expect(p.toNext).toBe(150);
  });
});
