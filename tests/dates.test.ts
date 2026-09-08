import { describe, it, expect, vi, afterEach } from "vitest";
import {
  legacyToday,
  ymd,
  wkYmd,
  fmtD,
  getWeekMon,
  wkParse,
  getLogicalDay,
} from "../src/lib/dates";

afterEach(() => {
  vi.useRealTimers();
});

describe("ymd (local YYYY-MM-DD)", () => {
  it("formats a local Date with zero-padding", () => {
    expect(ymd(new Date(2025, 0, 5))).toBe("2025-01-05");
    expect(ymd(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
  it("wkYmd is an alias of ymd", () => {
    expect(wkYmd).toBe(ymd);
  });
});

describe("fmtD", () => {
  it("turns YYYY-MM-DD into DD/MM", () => {
    expect(fmtD("2025-07-09")).toBe("09/07");
  });
});

describe("wkParse", () => {
  it("parses a day-key to local midnight", () => {
    const d = wkParse("2025-07-15");
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(15);
  });
});

describe("getWeekMon", () => {
  it("returns the Monday of the current week", () => {
    // Wednesday 2025-07-16 -> Monday 2025-07-14
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-16T12:00:00Z"));
    expect(getWeekMon()).toBe("2025-07-14");
    // Sunday 2025-07-20 -> previous Monday 2025-07-14
    vi.setSystemTime(new Date("2025-07-20T12:00:00Z"));
    expect(getWeekMon()).toBe("2025-07-14");
  });
});

describe("legacy UTC-vs-local date bug (pinned; fixed in Phase 1)", () => {
  it("legacyToday() disagrees with local ymd() just after local midnight in BST", () => {
    if (new Date("2025-07-15T23:30:00Z").getTimezoneOffset() === 0) {
      // TZ override didn't apply on this runner — nothing to assert.
      return;
    }
    vi.useFakeTimers();
    // 23:30 UTC on 15 Jul == 00:30 BST on 16 Jul
    vi.setSystemTime(new Date("2025-07-15T23:30:00Z"));
    expect(legacyToday()).toBe("2025-07-15"); // UTC calendar day — the bug
    expect(ymd(new Date())).toBe("2025-07-16"); // local calendar day — correct
  });
});

describe("getLogicalDay", () => {
  it("with no fajr time, equals legacyToday()", () => {
    expect(getLogicalDay(null)).toBe(legacyToday());
  });
  it("before fajr, rolls back to the previous calendar day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-15T02:00:00Z")); // 02:00, before a 05:00 fajr
    const res = getLogicalDay("05:00");
    const prev = new Date("2025-07-15T02:00:00Z");
    prev.setDate(prev.getDate() - 1);
    expect(res).toBe(prev.toISOString().split("T")[0]);
  });
  it("after fajr, equals legacyToday()", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-15T12:00:00Z"));
    expect(getLogicalDay("05:00")).toBe(legacyToday());
  });
});
