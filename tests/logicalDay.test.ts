import { describe, it, expect } from "vitest";
import { logicalDay, ymd } from "../src/lib/dates";

/** A local-time Date, so these tests do not depend on the machine's timezone. */
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

describe("logicalDay", () => {
  const fajr = "05:12";

  it("is the calendar day once Fajr has passed", () => {
    expect(logicalDay(at(2026, 3, 4, 6, 0), fajr)).toBe("2026-03-04");
    expect(logicalDay(at(2026, 3, 4, 23, 30), fajr)).toBe("2026-03-04");
  });

  it("is still yesterday in the small hours before Fajr", () => {
    // 2am on the 4th belongs to the night of the 3rd.
    expect(logicalDay(at(2026, 3, 4, 2, 0), fajr)).toBe("2026-03-03");
    expect(logicalDay(at(2026, 3, 4, 0, 1), fajr)).toBe("2026-03-03");
  });

  it("flips exactly at Fajr, not a minute either side", () => {
    expect(logicalDay(at(2026, 3, 4, 5, 11), fajr)).toBe("2026-03-03");
    expect(logicalDay(at(2026, 3, 4, 5, 12), fajr)).toBe("2026-03-04");
  });

  it("crosses a month boundary correctly", () => {
    expect(logicalDay(at(2026, 3, 1, 3, 0), fajr)).toBe("2026-02-28");
  });

  it("crosses a year boundary correctly", () => {
    expect(logicalDay(at(2027, 1, 1, 3, 0), fajr)).toBe("2026-12-31");
  });

  it("falls back to the calendar day with no Fajr time", () => {
    const now = at(2026, 3, 4, 2, 0);
    expect(logicalDay(now, null)).toBe(ymd(now));
    expect(logicalDay(now, undefined)).toBe(ymd(now));
  });

  it("falls back rather than throwing on a nonsense time", () => {
    const now = at(2026, 3, 4, 2, 0);
    expect(logicalDay(now, "not a time")).toBe(ymd(now));
    expect(logicalDay(now, "29:00")).toBe(ymd(now));
    expect(logicalDay(now, "")).toBe(ymd(now));
  });

  it("uses local time, not UTC", () => {
    // 23:30 local on a BST evening is already the next day in UTC. The old
    // helper formatted with toISOString() and returned the wrong key here.
    const late = at(2026, 6, 15, 23, 30);
    expect(logicalDay(late, fajr)).toBe("2026-06-15");
  });
});
