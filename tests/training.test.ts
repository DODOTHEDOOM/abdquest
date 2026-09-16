import { describe, it, expect } from "vitest";
import {
  ACTIVITIES,
  activityById,
  applyGymSession,
  checkPR,
  epley1RM,
  libraryFromSessions,
  sessionHeadline,
  sessionMinutes,
  setsSummary,
  topReps,
  topWeight,
  volumeOf,
  weekStartOf,
  weekStats,
  weeklySeries,
  type Exercise,
  type GymSession,
  type Session,
} from "../src/lib/training";

const gym = (
  date: string,
  sets: { reps: number; weight: number }[],
  id = "ex_bench",
): GymSession => ({
  id: "s_" + date,
  date,
  activityId: "gym",
  kind: "gym",
  exerciseId: id,
  name: "Bench press",
  metric: "weight",
  sets,
});

describe("activities", () => {
  it("covers gym, cardio and sports, and falls back safely", () => {
    const kinds = new Set(ACTIVITIES.map((a) => a.kind));
    expect(kinds).toContain("gym");
    expect(kinds).toContain("cardio");
    expect(kinds).toContain("sport");
    expect(activityById("football").name).toBe("Football");
    expect(activityById("nope").id).toBe("other");
  });
});

describe("set maths", () => {
  const sets = [
    { reps: 10, weight: 60 },
    { reps: 8, weight: 70 },
    { reps: 5, weight: 80 },
  ];
  it("volume is total kilograms moved", () => {
    expect(volumeOf(sets)).toBe(10 * 60 + 8 * 70 + 5 * 80);
  });
  it("top weight and top reps", () => {
    expect(topWeight(sets)).toBe(80);
    expect(topReps(sets)).toBe(10);
  });
  it("Epley 1RM rewards a heavy set over a light one", () => {
    // 5x80 -> 80*(1+5/30) = 93.3 beats 10x60 -> 80
    expect(epley1RM(sets)).toBeCloseTo(93.3, 1);
    expect(epley1RM([{ reps: 0, weight: 0 }])).toBe(0);
  });
  it("gym minutes are estimated from set count", () => {
    expect(sessionMinutes(gym("2026-03-02", sets))).toBe(9);
    expect(
      sessionMinutes({
        id: "c",
        date: "2026-03-02",
        activityId: "run",
        kind: "cardio",
        minutes: 42,
      }),
    ).toBe(42);
  });
});

describe("personal records", () => {
  it("weighted exercises are judged on top weight", () => {
    const pr = checkPR(undefined, [{ reps: 5, weight: 80 }], "weight");
    expect(pr).toMatchObject({ isPR: true, kind: "weight", previous: 0, next: 80 });
  });

  it("bodyweight exercises are judged on reps, not weight", () => {
    const ex: Exercise = {
      id: "ex_pushup",
      name: "Pushups",
      metric: "bodyweight",
      history: {},
      pr: { weight: 0, reps: 30 },
    };
    expect(checkPR(ex, [{ reps: 28, weight: 0 }], "bodyweight").isPR).toBe(false);
    const beat = checkPR(ex, [{ reps: 35, weight: 0 }], "bodyweight");
    expect(beat).toMatchObject({ isPR: true, kind: "reps", previous: 30, next: 35 });
  });

  it("matching your best is not a new record", () => {
    const ex: Exercise = {
      id: "ex_bench",
      name: "Bench",
      metric: "weight",
      history: {},
      pr: { weight: 80, reps: 5 },
    };
    expect(checkPR(ex, [{ reps: 5, weight: 80 }], "weight").isPR).toBe(false);
  });
});

describe("library", () => {
  it("records history, last sets and PRs across sessions", () => {
    const sessions = [
      gym("2026-03-02", [{ reps: 5, weight: 70 }]),
      gym("2026-03-05", [{ reps: 5, weight: 75 }]),
      gym("2026-03-09", [{ reps: 5, weight: 72 }]),
    ];
    const lib = libraryFromSessions(sessions);
    expect(lib).toHaveLength(1);
    const ex = lib[0];
    expect(Object.keys(ex.history)).toEqual(["2026-03-02", "2026-03-05", "2026-03-09"]);
    expect(ex.lastDate).toBe("2026-03-09");
    expect(ex.lastSets).toEqual([{ reps: 5, weight: 72 }]);
    // The PR stays at the best day, not the most recent one.
    expect(ex.pr).toMatchObject({ weight: 75, date: "2026-03-05" });
  });

  it("adds a new movement rather than overwriting an existing one", () => {
    let lib = libraryFromSessions([gym("2026-03-02", [{ reps: 5, weight: 70 }])]);
    lib = applyGymSession(lib, {
      ...gym("2026-03-03", [{ reps: 10, weight: 40 }], "ex_squat"),
      name: "Squat",
    });
    expect(lib.map((e) => e.name).sort()).toEqual(["Bench press", "Squat"]);
  });
});

describe("weeks", () => {
  it("weeks start on Monday", () => {
    expect(weekStartOf("2026-03-04")).toBe("2026-03-02"); // Wed -> Mon
    expect(weekStartOf("2026-03-02")).toBe("2026-03-02"); // Mon -> itself
    expect(weekStartOf("2026-03-08")).toBe("2026-03-02"); // Sun -> that Mon
  });

  it("week stats total sessions, minutes and volume by kind", () => {
    const sessions: Session[] = [
      gym("2026-03-02", [
        { reps: 10, weight: 50 },
        { reps: 10, weight: 50 },
      ]),
      { id: "r1", date: "2026-03-04", activityId: "run", kind: "cardio", minutes: 30 },
      { id: "f1", date: "2026-03-07", activityId: "football", kind: "sport", minutes: 90 },
      // Outside the week — must be excluded.
      { id: "r2", date: "2026-03-09", activityId: "run", kind: "cardio", minutes: 30 },
    ];
    const w = weekStats(sessions, "2026-03-02");
    expect(w.sessions).toBe(3);
    expect(w.minutes).toBe(6 + 30 + 90);
    expect(w.volume).toBe(1000);
    expect(w.byKind).toMatchObject({ gym: 1, cardio: 1, sport: 1 });
  });

  it("weeklySeries returns the requested number of weeks, oldest first", () => {
    const s = weeklySeries([gym("2026-03-04", [{ reps: 5, weight: 100 }])], "2026-03-04", 4);
    expect(s).toHaveLength(4);
    expect(s[3].start).toBe("2026-03-02");
    expect(s[3].sessions).toBe(1);
    expect(s[0].sessions).toBe(0);
    expect(s.map((w) => w.start)).toEqual([...s.map((w) => w.start)].sort());
  });
});

describe("display", () => {
  it("summarises gym sessions by metric", () => {
    expect(
      sessionHeadline(
        gym("2026-03-02", [
          { reps: 10, weight: 60 },
          { reps: 8, weight: 70 },
        ]),
      ),
    ).toBe("2 sets · 70kg top · 1160kg total");
    expect(
      sessionHeadline({
        ...gym("2026-03-02", [{ reps: 30, weight: 0 }]),
        metric: "bodyweight",
      }),
    ).toBe("1 set · 30 top reps");
  });

  it("summarises effort sessions from whatever was recorded", () => {
    expect(
      sessionHeadline({
        id: "x",
        date: "2026-03-02",
        activityId: "swim",
        kind: "cardio",
        minutes: 45,
        distanceKm: 1.5,
        intensity: "hard",
      }),
    ).toBe("45 min · 1.5 km · Hard");
    expect(
      sessionHeadline({
        id: "y",
        date: "2026-03-02",
        activityId: "padel",
        kind: "sport",
        minutes: 0,
      }),
    ).toBe("Padel");
  });

  it("last-time summary reads differently for bodyweight", () => {
    expect(
      setsSummary(
        [
          { reps: 10, weight: 60 },
          { reps: 8, weight: 70 },
        ],
        "weight",
      ),
    ).toBe("10×60kg  ·  8×70kg");
    expect(setsSummary([{ reps: 30, weight: 0 }], "bodyweight")).toBe("30 reps");
  });
});

describe("previousBest", () => {
  it("reports the best before the record, so a PR reads as a real gain", async () => {
    const { previousBest } = await import("../src/lib/training");
    const lib = libraryFromSessions([
      gym("2026-03-02", [{ reps: 5, weight: 70 }]),
      gym("2026-03-05", [{ reps: 5, weight: 75 }]),
      gym("2026-03-09", [{ reps: 5, weight: 100 }]),
    ]);
    expect(lib[0].pr.weight).toBe(100);
    expect(previousBest(lib[0])).toBe(75);
  });

  it("is zero for a first-ever session, not the record itself", async () => {
    const { previousBest } = await import("../src/lib/training");
    const lib = libraryFromSessions([gym("2026-03-02", [{ reps: 5, weight: 70 }])]);
    expect(previousBest(lib[0])).toBe(0);
  });
});
