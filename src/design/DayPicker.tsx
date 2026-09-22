/**
 * Pick which day you are looking at.
 *
 * Everything in the app used to be hardwired to the current day, so forgetting
 * to tick something last night meant it was gone and the streak broke for a day
 * you had actually done. This is how you go back and put it right.
 *
 * Deliberately only goes backwards. There is no honest reason to record having
 * done something tomorrow, and letting people do it turns the whole record into
 * a wish list.
 */

import { tick } from "./charts";

function parse(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function key(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function shiftDay(dateKey: string, days: number): string {
  const d = parse(dateKey);
  d.setDate(d.getDate() + days);
  return key(d);
}

/** How many days back the picker offers. Far enough to fix a forgetful week. */
export const DAYS_BACK = 13;

export function dayLabel(dateKey: string, today: string): string {
  if (dateKey === today) return "Today";
  if (dateKey === shiftDay(today, -1)) return "Yesterday";
  return parse(dateKey).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function DayPicker({
  value,
  today,
  onChange,
  daysBack = DAYS_BACK,
}: {
  value: string;
  today: string;
  onChange: (date: string) => void;
  daysBack?: number;
}) {
  const days: string[] = [];
  for (let i = daysBack; i >= 0; i--) days.push(shiftDay(today, -i));

  const editingPast = value !== today;

  return (
    <div className="daypicker">
      <div className="daypicker__strip" role="group" aria-label="Choose a day">
        {days.map((d) => {
          const date = parse(d);
          const selected = d === value;
          return (
            <button
              key={d}
              className={`daychip${selected ? " is-on" : ""}${d === today ? " is-today" : ""}`}
              aria-pressed={selected}
              aria-label={dayLabel(d, today)}
              onClick={() => {
                tick();
                onChange(d);
              }}
            >
              <span className="daychip__dow">
                {date.toLocaleDateString(undefined, { weekday: "narrow" })}
              </span>
              <span className="daychip__num">{date.getDate()}</span>
            </button>
          );
        })}
      </div>

      {editingPast && (
        <div className="daypicker__note">
          <span>
            Editing <strong>{dayLabel(value, today)}</strong>
          </span>
          <button onClick={() => onChange(today)}>Back to today</button>
        </div>
      )}
    </div>
  );
}
