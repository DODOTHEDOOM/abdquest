import { describe, it, expect } from "vitest";
import { buildPrayerCalendar, calendarFilename, type DayTimes } from "../src/lib/calendar";

const NOW = new Date("2026-03-04T09:00:00Z");

const day: DayTimes = {
  date: "2026-03-04",
  times: { fajr: "05:12", duhr: "13:04", asr: "16:30", maghrib: "19:48", isha: "21:20" },
};

describe("buildPrayerCalendar", () => {
  const ics = buildPrayerCalendar([day], {}, NOW);

  it("is a well-formed calendar with CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    // Every line break must be CRLF, not bare LF.
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("writes one event per prayer at the right local time", () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(5);
    expect(ics).toContain("DTSTART:20260304T051200");
    expect(ics).toContain("DTSTART:20260304T212000");
  });

  it("uses floating local time, so travelling does not shift the times", () => {
    // No TZID and no trailing Z on DTSTART.
    expect(ics).not.toContain("TZID");
    expect(/DTSTART:\d{8}T\d{6}Z/.test(ics)).toBe(false);
  });

  it("gives every event a display alarm", () => {
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(5);
    expect(ics).toContain("ACTION:DISPLAY");
    expect(ics).toContain("TRIGGER:-PT0M");
  });

  it("honours a lead time", () => {
    const early = buildPrayerCalendar([day], { minutesBefore: 10 }, NOW);
    expect(early).toContain("TRIGGER:-PT10M");
  });

  it("can be limited to particular prayers", () => {
    const fajrOnly = buildPrayerCalendar([day], { only: ["fajr"] }, NOW);
    expect(fajrOnly.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(fajrOnly).toContain("SUMMARY:Fajr");
    expect(fajrOnly).not.toContain("SUMMARY:Isha");
  });

  it("gives each event a stable unique id, so re-importing updates rather than duplicates", () => {
    expect(ics).toContain("UID:2026-03-04-fajr@abdquest");
    const again = buildPrayerCalendar([day], {}, new Date("2026-05-01T00:00:00Z"));
    expect(again).toContain("UID:2026-03-04-fajr@abdquest");
  });

  it("skips missing or malformed times rather than writing a broken event", () => {
    const patchy = buildPrayerCalendar(
      [{ date: "2026-03-04", times: { fajr: "05:12", duhr: "nonsense" } }],
      {},
      NOW,
    );
    expect(patchy.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(patchy).toContain("SUMMARY:Fajr");
  });

  it("produces a valid empty calendar when there is nothing to write", () => {
    const none = buildPrayerCalendar([], {}, NOW);
    expect(none).toContain("BEGIN:VCALENDAR");
    expect(none).not.toContain("BEGIN:VEVENT");
  });

  it("covers several days at once", () => {
    const week = buildPrayerCalendar(
      [day, { ...day, date: "2026-03-05" }, { ...day, date: "2026-03-06" }],
      {},
      NOW,
    );
    expect(week.match(/BEGIN:VEVENT/g)).toHaveLength(15);
  });
});

describe("calendarFilename", () => {
  it("is dated so an older export is distinguishable", () => {
    expect(calendarFilename(new Date(2026, 2, 4))).toBe("prayer-times-2026-03-04.ics");
  });
});
