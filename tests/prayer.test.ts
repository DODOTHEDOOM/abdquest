import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  cachedTimes,
  cleanTime,
  fetchPrayerTimes,
  formatIn,
  minutesOf,
  nextPrayer,
  prayerConsistency,
  prayerStreak,
  DEFAULT_CALC,
  isOnTime,
} from "../src/lib/prayer";

beforeEach(() => localStorage.clear());

const TIMES = {
  fajr: "05:12",
  duhr: "13:04",
  asr: "16:30",
  maghrib: "19:48",
  isha: "21:20",
};

const ALL = { fajr: true, duhr: true, asr: true, maghrib: true, isha: true };

describe("parsing times", () => {
  it("strips the timezone the API appends", () => {
    expect(cleanTime("05:12 (BST)")).toBe("05:12");
    expect(cleanTime("5:07")).toBe("05:07");
  });

  it("rejects nonsense rather than guessing", () => {
    expect(cleanTime("")).toBeNull();
    expect(cleanTime("29:00")).toBeNull();
    expect(cleanTime("12:99")).toBeNull();
    expect(minutesOf("not a time")).toBeNull();
  });

  it("converts to minutes since midnight", () => {
    expect(minutesOf("00:00")).toBe(0);
    expect(minutesOf("13:04")).toBe(784);
  });
});

describe("nextPrayer", () => {
  it("finds the next one still to come", () => {
    const n = nextPrayer(TIMES, 13 * 60); // 13:00
    expect(n).toMatchObject({ id: "duhr", tomorrow: false, inMinutes: 4 });
  });

  it("counts a prayer that has just started as next until it passes", () => {
    expect(nextPrayer(TIMES, 16 * 60 + 30)?.id).toBe("asr");
  });

  it("rolls round to tomorrow's Fajr after Isha", () => {
    const n = nextPrayer(TIMES, 23 * 60); // 23:00
    expect(n).toMatchObject({ id: "fajr", tomorrow: true });
    // 1h to midnight + 5h12m to Fajr.
    expect(n?.inMinutes).toBe(60 + 312);
  });

  it("returns null when there are no usable times", () => {
    expect(nextPrayer({}, 600)).toBeNull();
    expect(nextPrayer({ fajr: "bad" }, 600)).toBeNull();
  });

  it("formats the countdown readably", () => {
    expect(formatIn(0)).toBe("now");
    expect(formatIn(42)).toBe("in 42 min");
    expect(formatIn(60)).toBe("in 1h");
    expect(formatIn(134)).toBe("in 2h 14m");
  });
});

describe("prayerStreak", () => {
  it("counts consecutive complete days", () => {
    const done = {
      "2026-03-01": ALL,
      "2026-03-02": ALL,
      "2026-03-03": ALL,
    };
    // Today is not finished yet — yesterday still anchors it.
    expect(prayerStreak(done, "2026-03-04")).toBe(3);
  });

  it("includes today once all five are in", () => {
    expect(prayerStreak({ "2026-03-03": ALL, "2026-03-04": ALL }, "2026-03-04")).toBe(2);
  });

  it("a partial day breaks the run", () => {
    const done = {
      "2026-03-01": ALL,
      "2026-03-02": { fajr: true, duhr: true },
      "2026-03-03": ALL,
    };
    expect(prayerStreak(done, "2026-03-04")).toBe(1);
  });

  it("is zero with nothing recorded", () => {
    expect(prayerStreak({}, "2026-03-04")).toBe(0);
  });
});

describe("prayerConsistency", () => {
  it("separates complete days from partial ones", () => {
    const done = {
      "2026-03-04": ALL,
      "2026-03-03": { fajr: true },
      "2026-03-02": ALL,
      "2026-02-01": ALL, // outside the window
    };
    expect(prayerConsistency(done, "2026-03-04", 7)).toEqual({ full: 2, partial: 1, days: 7 });
  });
});

describe("fetchPrayerTimes", () => {
  const place = { lat: 53.3811, lon: -1.4701 };
  const body = {
    data: {
      timings: {
        Fajr: "05:12 (GMT)",
        Dhuhr: "13:04",
        Asr: "16:30",
        Maghrib: "19:48",
        Isha: "21:20",
      },
    },
  };
  const okFetch = () =>
    vi.fn(async () => ({ ok: true, json: async () => body }) as unknown as Response);

  it("maps the API names onto prayer ids and caches the result", async () => {
    const f = okFetch();
    const r = await fetchPrayerTimes(
      "2026-03-04",
      place,
      DEFAULT_CALC,
      f as unknown as typeof fetch,
    );
    expect(r?.times).toEqual(TIMES);
    expect(cachedTimes("2026-03-04", place)?.times).toEqual(TIMES);

    // A second call is served from cache without touching the network.
    await fetchPrayerTimes("2026-03-04", place, DEFAULT_CALC, f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("ignores a cache entry from a different place", async () => {
    const f = okFetch();
    await fetchPrayerTimes("2026-03-04", place, DEFAULT_CALC, f as unknown as typeof fetch);
    expect(cachedTimes("2026-03-04", { lat: 51.5, lon: -0.12 })).toBeNull();
  });

  it("does not serve cached times computed with a different method", async () => {
    const f = okFetch();
    await fetchPrayerTimes("2026-03-04", place, DEFAULT_CALC, f as unknown as typeof fetch);
    // Switching to Muslim World League must recompute, not reuse ISNA's answer.
    expect(cachedTimes("2026-03-04", place, { method: 3, school: 0 })).toBeNull();
    // And likewise for the Asr school.
    expect(cachedTimes("2026-03-04", place, { method: 2, school: 1 })).toBeNull();
    expect(cachedTimes("2026-03-04", place, DEFAULT_CALC)).not.toBeNull();
  });

  it("sends the chosen method and school to the API", async () => {
    const f = okFetch();
    await fetchPrayerTimes(
      "2026-03-04",
      place,
      { method: 3, school: 1 },
      f as unknown as typeof fetch,
    );
    const url = String((f as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]);
    expect(url).toContain("method=3");
    expect(url).toContain("school=1");
  });

  it("returns null instead of throwing when offline", async () => {
    const dead = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(
      fetchPrayerTimes("2026-03-04", place, DEFAULT_CALC, dead as unknown as typeof fetch),
    ).resolves.toBeNull();
  });

  it("returns null on a bad response rather than inventing times", async () => {
    const bad = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as unknown as Response);
    await expect(
      fetchPrayerTimes("2026-03-04", place, DEFAULT_CALC, bad as unknown as typeof fetch),
    ).resolves.toBeNull();
  });
});

describe("isOnTime", () => {
  const sunrise = "06:48";

  it("counts a prayer inside its own window", () => {
    expect(isOnTime("duhr", TIMES, 13 * 60 + 30, sunrise)).toBe(true);
    expect(isOnTime("asr", TIMES, 17 * 60, sunrise)).toBe(true);
  });

  it("counts one prayed after the next has started as late", () => {
    // Duhr prayed at 17:00, an hour after Asr began.
    expect(isOnTime("duhr", TIMES, 17 * 60, sunrise)).toBe(false);
  });

  it("ends the Fajr window at sunrise, not at Duhr", () => {
    expect(isOnTime("fajr", TIMES, 6 * 60, sunrise)).toBe(true);
    expect(isOnTime("fajr", TIMES, 7 * 60, sunrise)).toBe(false);
    // Without sunrise it can only fall back to the next prayer.
    expect(isOnTime("fajr", TIMES, 7 * 60)).toBe(true);
  });

  it("treats the rest of the night after Isha as on time", () => {
    expect(isOnTime("isha", TIMES, 23 * 60, sunrise)).toBe(true);
  });

  it("is null, not false, when the time is unknown", () => {
    // Unknown must never be recorded as late.
    expect(isOnTime("asr", {}, 17 * 60)).toBeNull();
    expect(isOnTime("nonsense", TIMES, 17 * 60)).toBeNull();
  });
});
