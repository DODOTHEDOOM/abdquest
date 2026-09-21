import { describe, it, expect, beforeEach } from "vitest";
import {
  backupFilename,
  BACKUP_KEY,
  buildBackup,
  hasRescuePoint,
  parseBackup,
  readRescuePoint,
  readRollingBackup,
  RESCUE_KEY,
  saveRescuePoint,
  saveRollingBackup,
  serialiseBackup,
  storageReport,
} from "../src/lib/backup";
import { emptyState, type AppState } from "../src/state/schema";

beforeEach(() => localStorage.clear());

function sample(): AppState {
  return {
    ...emptyState(),
    habits: [{ id: "h1", name: "Move" }],
    done: { "2026-03-04": { h1: true } },
    xp: 4200,
    streak: { current: 12, best: 15, lastDay: "2026-03-04" },
  };
}

/** A backup saved by the OLD app: the bare v2 object, nothing wrapped around it. */
const OLD_BACKUP = {
  xp: 4200,
  streak: 12,
  bestStreak: 15,
  lastDay: "2026-03-04",
  done: { nojunk: true },
  habits: [{ id: "nojunk", label: "Zero Junk Food" }],
  prayers: [{ id: "fajr", label: "Fajr" }],
  prayerHist: { "2026-03-02": { fajr: true } },
  debt: { fajr: 9 },
  wtLog: [{ date: "2026-03-01", wt: 148.5 }],
};

describe("exporting", () => {
  it("wraps the state with enough metadata to recognise it later", () => {
    const b = buildBackup(sample(), new Date("2026-03-04T09:00:00Z"));
    expect(b.app).toBe("abdquest");
    expect(b.format).toBe(1);
    expect(b.exportedAt).toBe("2026-03-04T09:00:00.000Z");
    expect(b.state.xp).toBe(4200);
  });

  it("names the file by the day it was taken", () => {
    expect(backupFilename(new Date(2026, 2, 4))).toBe("abdquest_backup_2026-03-04.json");
  });

  it("round-trips through text without losing anything", () => {
    const state = sample();
    const result = parseBackup(serialiseBackup(state));
    expect(result.ok).toBe(true);
    expect(result.state).toEqual(state);
    expect(result.source).toBe("v3-file");
  });
});

describe("importing old backups", () => {
  it("accepts a file saved by the old app and converts it", () => {
    const r = parseBackup(JSON.stringify(OLD_BACKUP));
    expect(r.ok).toBe(true);
    expect(r.source).toBe("v2-bare");
    expect(r.state!.xp).toBe(4200);
    expect(r.state!.streak).toEqual({ current: 12, best: 15, lastDay: "2026-03-04" });
    expect(r.state!.habits[0].name).toBe("Zero Junk Food");
    expect(r.state!.prayers.debt).toEqual({ fajr: 9 });
    expect(r.state!.profile.weightKg).toBe(148.5);
    expect(r.notes.join(" ")).toContain("old app");
  });

  it("accepts a bare v3 state as well as a wrapped one", () => {
    const r = parseBackup(JSON.stringify(sample()));
    expect(r.ok).toBe(true);
    expect(r.source).toBe("v3-bare");
    expect(r.state!.xp).toBe(4200);
  });
});

describe("rejecting bad files", () => {
  it("refuses text that is not JSON, and says nothing changed", () => {
    const r = parseBackup("this is not json");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("nothing was changed");
  });

  it("refuses JSON that is not a backup", () => {
    expect(parseBackup(JSON.stringify({ hello: "world" })).ok).toBe(false);
    expect(parseBackup(JSON.stringify([1, 2, 3])).ok).toBe(false);
    expect(parseBackup("null").ok).toBe(false);
  });

  it("warns rather than fails on a backup from a newer version", () => {
    const r = parseBackup(
      JSON.stringify({ app: "abdquest", format: 99, exportedAt: "x", state: sample() }),
    );
    expect(r.ok).toBe(true);
    expect(r.notes.join(" ")).toContain("newer version");
  });
});

describe("surviving a damaged file", () => {
  it("fills in missing containers instead of loading a state that would crash", () => {
    const r = parseBackup(JSON.stringify({ version: 3, xp: 50 }));
    expect(r.ok).toBe(true);
    expect(r.state!.sessions).toEqual([]);
    expect(r.state!.done).toEqual({});
    expect(r.state!.prayers).toEqual({ done: {}, debt: {}, onTime: {}, fajrTime: null });
    expect(r.state!.habits.length).toBeGreaterThan(0);
    expect(r.state!.xp).toBe(50);
  });

  it("repairs containers of the wrong type", () => {
    const r = parseBackup(
      JSON.stringify({
        version: 3,
        xp: "lots",
        sessions: "nope",
        done: [],
        habits: [],
        prayers: { done: null, debt: null },
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.state!.xp).toBe(0);
    expect(r.state!.sessions).toEqual([]);
    expect(r.state!.done).toEqual({});
    expect(r.state!.habits.length).toBeGreaterThan(0);
    expect(r.state!.prayers).toEqual({ done: {}, debt: {}, onTime: {}, fajrTime: null });
  });

  it("never lets a negative or absurd xp through", () => {
    const r = parseBackup(JSON.stringify({ version: 3, xp: -500 }));
    expect(r.ok).toBe(true);
    expect(r.state!.xp).toBe(0);
  });
});

describe("rescue slots", () => {
  it("keeps a copy that can be read back after an import", () => {
    const state = sample();
    expect(hasRescuePoint()).toBe(false);
    expect(saveRescuePoint(state)).toBe(true);
    expect(hasRescuePoint()).toBe(true);
    expect(readRescuePoint()?.xp).toBe(4200);
  });

  it("keeps a rolling copy alongside the main save", () => {
    expect(saveRollingBackup(sample())).toBe(true);
    expect(readRollingBackup()?.streak.best).toBe(15);
  });

  it("returns null rather than throwing when a slot is corrupt", () => {
    localStorage.setItem(RESCUE_KEY, "{broken");
    expect(readRescuePoint()).toBeNull();
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ not: "a state" }));
    expect(readRollingBackup()).toBeNull();
  });
});

describe("storage report", () => {
  it("lists only this app's keys, largest first", () => {
    localStorage.setItem("abdquest_v3", "x".repeat(100));
    localStorage.setItem("abdquest_v2", "y".repeat(400));
    localStorage.setItem("somethingelse", "z".repeat(999));
    const r = storageReport();
    expect(r.keys.map((k) => k.key)).toEqual(["abdquest_v2", "abdquest_v3"]);
    expect(r.totalBytes).toBe(500);
  });
});
