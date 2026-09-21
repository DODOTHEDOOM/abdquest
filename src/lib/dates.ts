// Date helpers extracted from legacy/AbdQuest.html.
//
// KNOWN BUG (pinned here, fixed in Phase 1): `legacyToday()` formats in UTC via
// toISOString(), while `wkYmd()` formats in local time. The two disagree in the
// evening for UTC+ timezones (e.g. UK during BST), so day-keys can land on the
// wrong date. Phase 1 introduces `ymd()` (local) everywhere and removes the UTC one.
// The characterization tests lock in the CURRENT behaviour so the Phase 1 change is
// visible and deliberate.

/** Legacy UTC-based "today" (YYYY-MM-DD). Buggy near midnight; kept only so the
 *  Phase 0 tests can pin existing behaviour. Do not use in new code — use `ymd`. */
export function legacyToday(): string {
  return new Date().toISOString().split("T")[0];
}

/** Local-time YYYY-MM-DD. This is the correct helper going forward. */
export function ymd(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

/** Legacy alias used throughout the old code as `wkYmd`. Same as `ymd`. */
export const wkYmd = ymd;

/**
 * The day the app should be recording against, which is not always the calendar
 * day.
 *
 * The old app reset the day at Fajr rather than midnight: something logged at
 * 2am belongs to the night you are still awake for, not to the morning you have
 * not started. That is the behaviour people actually expect from a tracker with
 * prayers in it, and it is carried across here.
 *
 * Local time throughout. The legacy version formatted with toISOString(), which
 * is UTC, and produced the wrong key on British Summer Time evenings.
 *
 * Pure so it can be tested at arbitrary clock times: pass `now` rather than
 * reading the clock inside.
 */
export function logicalDay(now: Date, fajrTime?: string | null): string {
  if (!fajrTime) return ymd(now);
  const m = /^(\d{1,2}):(\d{2})$/.exec(fajrTime.trim());
  if (!m) return ymd(now);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return ymd(now);

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  if (minutesNow >= h * 60 + min) return ymd(now);

  // Before Fajr: the previous day is still running.
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return ymd(y);
}

/** @deprecated Legacy UTC-based version. Use `logicalDay` instead. */
export function getLogicalDay(fajrTime: string | null | undefined): string {
  if (!fajrTime) return legacyToday();
  const now = new Date();
  const parts = fajrTime.split(":");
  const fajr = new Date();
  fajr.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
  if (now < fajr) {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return y.toISOString().split("T")[0];
  }
  return legacyToday();
}

/** "YYYY-MM-DD" -> "DD/MM" */
export function fmtD(d: string): string {
  const p = d.split("-");
  return p[2] + "/" + p[1];
}

/** Monday of the current week, as YYYY-MM-DD (UTC-formatted, legacy behaviour). */
export function getWeekMon(): string {
  const d = new Date();
  const day = d.getDay();
  const m = new Date(d);
  m.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return m.toISOString().split("T")[0];
}

/** "YYYY-MM-DD" -> Date at local midnight. */
export function wkParse(k: string): Date {
  const p = k.split("-");
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
