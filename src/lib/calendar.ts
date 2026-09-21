/**
 * Prayer reminders, as a calendar file.
 *
 * A web app cannot schedule a notification for a time when it is not running.
 * The Notifications API only fires while a page or service worker is alive, and
 * real push requires a server this app deliberately does not have. Periodic
 * background sync, which would be the other route, is not supported on iOS at
 * all.
 *
 * So rather than shipping reminders that silently do not arrive, this writes an
 * .ics file. Opening it on an iPhone puts the times in the calendar with proper
 * alarms, which the phone then handles natively, offline, with no server and no
 * permission prompt from us. It is the honest version of the feature.
 *
 * Regenerate it every few weeks, since prayer times drift through the year.
 */

import { PRAYERS } from "../state/schema";

export interface DayTimes {
  /** YYYY-MM-DD */
  date: string;
  /** prayer id -> "HH:MM" */
  times: Record<string, string>;
}

export interface ReminderOptions {
  /** Minutes before each prayer to alarm. 0 alarms at the time itself. */
  minutesBefore?: number;
  /** Only these prayer ids. Defaults to all five. */
  only?: string[];
}

/** RFC 5545 escaping: commas, semicolons, backslashes and newlines. */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function stamp(date: string, hm: string): string {
  return `${date.replace(/-/g, "")}T${hm.replace(":", "")}00`;
}

/**
 * Lines longer than 75 octets must be folded, or strict parsers reject the
 * file. Apple's is lenient; Google's is not.
 */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const out: string[] = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    out.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest) out.push(" " + rest);
  return out.join("\r\n");
}

/**
 * A calendar of prayer times.
 *
 * Each event is deliberately short (one minute) so it does not block out the
 * day in a calendar view, and carries a DISPLAY alarm rather than an email one.
 */
export function buildPrayerCalendar(
  days: DayTimes[],
  options: ReminderOptions = {},
  now = new Date(),
): string {
  const before = Math.max(0, Math.round(options.minutesBefore ?? 0));
  const only = options.only;

  const dtstamp =
    now
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")
      .replace(/Z$/, "") + "Z";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//abdquest//prayer times//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Prayer times",
  ];

  for (const day of days) {
    for (const p of PRAYERS) {
      if (only && !only.includes(p.id)) continue;
      const hm = day.times[p.id];
      if (!hm || !/^\d{2}:\d{2}$/.test(hm)) continue;

      const start = stamp(day.date, hm);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${day.date}-${p.id}@abdquest`,
        `DTSTAMP:${dtstamp}`,
        // Floating local time on purpose: a prayer time is local wherever the
        // phone is, and pinning a timezone would shift it when travelling.
        `DTSTART:${start}`,
        `DURATION:PT1M`,
        fold(`SUMMARY:${esc(p.name)}`),
        fold(`DESCRIPTION:${esc(`${p.name} at ${hm}`)}`),
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        fold(`DESCRIPTION:${esc(p.name)}`),
        `TRIGGER:-PT${before}M`,
        "END:VALARM",
        "END:VEVENT",
      );
    }
  }

  lines.push("END:VCALENDAR");
  // RFC 5545 requires CRLF.
  return lines.join("\r\n") + "\r\n";
}

export function calendarFilename(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `prayer-times-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.ics`;
}
