/**
 * The prayers section: today's five, the streak, and the debt ledger.
 *
 * Times need a location and a network; tracking needs neither. If the times are
 * unavailable the five still tap, the streak still counts and the debt still
 * clears. Only the countdown and the on-time marking go quiet, and on-time is
 * left unrecorded rather than guessed at.
 */

import { useEffect, useMemo, useState } from "react";
import { tick } from "../design/charts";
import { Badge, Button, Card, Field, SectionHeader, TextInput } from "../design/primitives";
import {
  cachedTimes,
  fetchPrayerTimes,
  formatIn,
  isOnTime,
  locate,
  nextPrayer,
  prayerConsistency,
  prayerStreak,
  type PrayerTimes,
} from "../lib/prayer";
import { buildPrayerCalendar, calendarFilename, type DayTimes } from "../lib/calendar";
import {
  ASR_SCHOOLS,
  DEFAULT_ASR_SCHOOL,
  DEFAULT_PRAYER_METHOD,
  PRAYERS,
  PRAYER_METHODS,
  prayerDebtTotal,
  prayersDoneOn,
} from "../state/schema";
import { useStore } from "../state/store";
import { useToday } from "../state/useToday";

function shift(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** Friday, when Duhr is replaced by Jumu'ah. */
function isFriday(dateKey: string): boolean {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getDay() === 5;
}

const dim: React.CSSProperties = { fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 };

export function Prayers() {
  const { state, dispatch } = useStore();
  const today = useToday();
  const place = state.place;

  const calc = useMemo(
    () => ({
      method: state.prayers.method ?? DEFAULT_PRAYER_METHOD,
      school: (state.prayers.school ?? DEFAULT_ASR_SCHOOL) as 0 | 1,
    }),
    [state.prayers.method, state.prayers.school],
  );

  const [data, setData] = useState<PrayerTimes | null>(() =>
    place ? cachedTimes(today, place, calc) : null,
  );
  const [locating, setLocating] = useState(false);
  const [timesError, setTimesError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [debtEdit, setDebtEdit] = useState<Record<string, string>>({});
  const [lead, setLead] = useState(10);
  const [reminderState, setReminderState] = useState<string | null>(null);
  const [buildingReminders, setBuildingReminders] = useState(false);
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  // Refetch whenever the day, the place or the calculation changes.
  useEffect(() => {
    if (!place) return;
    let cancelled = false;
    setData(cachedTimes(today, place, calc));
    void fetchPrayerTimes(today, place, calc).then((r) => {
      if (cancelled) return;
      if (r) {
        setData(r);
        setTimesError(null);
      } else {
        setTimesError("Could not reach the prayer-times service. Tracking still works.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [place, today, calc]);

  // Remember Fajr, because the app's day resets at it rather than at midnight.
  const fajr = data?.times.fajr ?? null;
  useEffect(() => {
    if (fajr && fajr !== state.prayers.fajrTime) {
      dispatch({ type: "setFajrTime", time: fajr });
    }
  }, [fajr, state.prayers.fajrTime, dispatch]);

  const times = data?.times ?? null;
  const doneToday = state.prayers.done[today] ?? {};
  const onTimeToday = state.prayers.onTime?.[today] ?? {};
  const doneCount = prayersDoneOn(state, today);
  const streak = useMemo(
    () => prayerStreak(state.prayers.done, today),
    [state.prayers.done, today],
  );
  const consistency = useMemo(
    () => prayerConsistency(state.prayers.done, today, 30),
    [state.prayers.done, today],
  );
  const next = times ? nextPrayer(times, nowMin) : null;
  const debtTotal = prayerDebtTotal(state);
  const friday = isFriday(today);
  const onTimeCount = PRAYERS.filter((p) => onTimeToday[p.id]).length;

  const askLocation = async () => {
    setLocating(true);
    const p = await locate();
    setLocating(false);
    if (p) dispatch({ type: "setPlace", place: p });
    else
      setTimesError(
        "Location was not shared, so times cannot be calculated. Tracking still works.",
      );
  };

  /**
   * Prayer times for the next month as a calendar file.
   *
   * A web app cannot fire a notification while it is closed, and there is no
   * push server behind this one, so rather than shipping reminders that
   * silently never arrive, the phone's own calendar does the alarms.
   */
  const makeReminders = async () => {
    if (!place) return;
    setBuildingReminders(true);
    setReminderState("Working out the next 30 days…");
    try {
      const days: DayTimes[] = [];
      for (let i = 0; i < 30; i++) {
        const date = shift(today, i);
        const r = cachedTimes(date, place, calc) ?? (await fetchPrayerTimes(date, place, calc));
        if (r) days.push({ date, times: r.times });
      }
      if (!days.length) {
        setReminderState("Could not get the times. Try again when you have a connection.");
        return;
      }

      const ics = buildPrayerCalendar(days, { minutesBefore: lead });
      const blob = new Blob([ics], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = calendarFilename();
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setReminderState(`${days.length} days ready. Open the file to add them to your calendar.`);
    } catch (e) {
      setReminderState(`Could not build the file: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBuildingReminders(false);
    }
  };

  const toggle = (id: string) => {
    tick();
    // Unknown times mean on-time is left unrecorded, never recorded as late.
    const ok = times ? isOnTime(id, times, nowMin, data?.sunrise) : null;
    dispatch({
      type: "togglePrayer",
      date: today,
      prayerId: id,
      onTime: ok === null ? undefined : ok,
    });
  };

  return (
    <>
      {/* Next prayer */}
      {next ? (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--text-faint)",
                  fontWeight: 700,
                }}
              >
                {next.tomorrow ? "Tomorrow" : "Next"}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>
                {friday && next.id === "duhr" ? "Jumu’ah" : next.name}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {next.at}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                {formatIn(next.inMinutes)}
              </div>
            </div>
          </div>
          {data?.hijri && (
            <div
              style={{
                ...dim,
                marginTop: 12,
                paddingTop: 10,
                borderTop: "1px solid var(--border)",
              }}
            >
              {data.hijri}
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Prayer times</div>
          <div style={{ ...dim, margin: "6px 0 12px" }}>
            {place
              ? (timesError ?? "Working them out…")
              : "Share your location once and the app can show today's times and what is next. You can track your prayers either way."}
          </div>
          {!place && (
            <Button variant="primary" sm onClick={askLocation} disabled={locating}>
              {locating ? "Asking…" : "Use my location"}
            </Button>
          )}
        </Card>
      )}

      {/* Today */}
      <SectionHeader
        title={friday ? "Today · Friday" : "Today"}
        right={
          <Badge tone={doneCount === PRAYERS.length ? "accent" : "neutral"}>
            {doneCount}/{PRAYERS.length}
          </Badge>
        }
      />
      <Card>
        <div style={{ display: "grid", gap: 8 }}>
          {PRAYERS.map((p) => {
            const done = !!doneToday[p.id];
            const late = done && onTimeToday[p.id] === false;
            const jumuah = friday && p.id === "duhr";
            return (
              <button
                key={p.id}
                className="prayerrow"
                aria-pressed={done}
                onClick={() => toggle(p.id)}
              >
                <span className="prayerrow__icon" aria-hidden>
                  {jumuah ? "\u{1F54C}" : p.icon}
                </span>
                <span className="prayerrow__body">
                  <span className="prayerrow__name">{jumuah ? "Jumu’ah" : p.name}</span>
                  <span className="prayerrow__detail">
                    {times?.[p.id] ? times[p.id] : p.detail}
                    {late && <span style={{ color: "var(--text-faint)" }}> &middot; late</span>}
                  </span>
                </span>
                <span className={`prayerrow__check${done ? " is-done" : ""}`} aria-hidden>
                  {done ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
        {times && doneCount > 0 && (
          <div style={{ ...dim, marginTop: 12, fontSize: 11.5 }}>
            {onTimeCount} of {doneCount} within the window.
          </div>
        )}
      </Card>

      {/* Consistency */}
      <SectionHeader title="Consistency" />
      <Card>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{streak}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
              day{streak === 1 ? "" : "s"} complete in a row
            </div>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{consistency.full}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
              full days in the last {consistency.days}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3, marginTop: 16 }}>
          {Array.from({ length: 30 }, (_, i) => {
            const key = shift(today, -(29 - i));
            const day = state.prayers.done[key];
            const n = day ? PRAYERS.filter((p) => day[p.id]).length : 0;
            return (
              <span
                key={key}
                title={`${key} — ${n}/5`}
                style={{
                  flex: 1,
                  height: 26,
                  borderRadius: 4,
                  background:
                    n === 5
                      ? "var(--m-recovery)"
                      : n > 0
                        ? "color-mix(in srgb, var(--m-recovery) 38%, transparent)"
                        : "var(--surface-2)",
                }}
              />
            );
          })}
        </div>
      </Card>

      {/* Debt */}
      <SectionHeader
        title="Missed prayers"
        right={
          <Badge tone={debtTotal > 0 ? "warn" : "accent"}>
            {debtTotal > 0 ? `${debtTotal} owed` : "All clear"}
          </Badge>
        }
      />
      <Card>
        <div style={{ ...dim, marginBottom: 14 }}>
          Prayers you owe, repaid by praying extras on top of the five. Tap Edit to set the count in
          one go, then knock it down as you go.
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {PRAYERS.map((p) => {
            const owed = Math.max(0, state.prayers.debt[p.id] ?? 0);
            const editing = debtEdit[p.id] !== undefined;
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "var(--surface-2)",
                }}
              >
                <span aria-hidden style={{ fontSize: 16 }}>
                  {p.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: owed > 0 ? "var(--text-dim)" : "var(--m-recovery)",
                    }}
                  >
                    {owed > 0 ? `${owed} owed` : "Cleared"}
                  </div>
                </div>

                {editing ? (
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ width: 78 }}>
                      <TextInput
                        type="number"
                        inputMode="numeric"
                        value={debtEdit[p.id]}
                        aria-label={`Prayers owed for ${p.name}`}
                        onChange={(e) => setDebtEdit({ ...debtEdit, [p.id]: e.target.value })}
                      />
                    </span>
                    <Button
                      sm
                      variant="primary"
                      onClick={() => {
                        const n = Number(debtEdit[p.id]);
                        if (isFinite(n) && n >= 0) {
                          dispatch({ type: "setPrayerDebt", prayerId: p.id, count: n });
                        }
                        const rest = { ...debtEdit };
                        delete rest[p.id];
                        setDebtEdit(rest);
                      }}
                    >
                      Set
                    </Button>
                  </span>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    {owed > 0 &&
                      [1, 5].map((n) => (
                        <Button
                          key={n}
                          sm
                          onClick={() => {
                            tick();
                            dispatch({ type: "payPrayerDebt", prayerId: p.id, count: n });
                          }}
                        >
                          +{Math.min(n, owed)}
                        </Button>
                      ))}
                    <Button
                      sm
                      onClick={() => setDebtEdit({ ...debtEdit, [p.id]: String(owed) })}
                      aria-label={`Set the number owed for ${p.name}`}
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Reminders */}
      <SectionHeader title="Reminders" />
      <Card>
        <div style={dim}>
          This app cannot buzz your phone on its own: a web app only runs while it is open, and
          there is no server behind this one to push to. Instead it writes the next 30 days of times
          into a calendar file, and your phone handles the alarms natively.
        </div>
        {place ? (
          <>
            <div style={{ marginTop: 14 }}>
              <Field label="Alarm" hint="How long before each prayer.">
                <select
                  className="field__control"
                  value={lead}
                  onChange={(e) => setLead(Number(e.target.value))}
                >
                  <option value={0}>At the time</option>
                  <option value={5}>5 minutes before</option>
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                </select>
              </Field>
            </div>
            <Button
              variant="primary"
              style={{ marginTop: 12 }}
              disabled={buildingReminders}
              onClick={makeReminders}
            >
              {buildingReminders ? "Working…" : "Add to my calendar"}
            </Button>
            {reminderState && (
              <div style={{ ...dim, marginTop: 10, color: "var(--text)" }}>{reminderState}</div>
            )}
            <div style={{ ...dim, marginTop: 10, fontSize: 11.5 }}>
              Run this again every few weeks. Prayer times drift through the year, and re-importing
              updates the same entries rather than duplicating them.
            </div>
          </>
        ) : (
          <div style={{ ...dim, marginTop: 10 }}>Set your location first.</div>
        )}
      </Card>

      {/* Settings */}
      <SectionHeader
        title="Prayer settings"
        action={showSettings ? "Hide" : "Change"}
        onAction={() => setShowSettings((v) => !v)}
      />
      {showSettings ? (
        <Card>
          <div style={{ display: "grid", gap: 14 }}>
            <Field
              label="Calculation method"
              hint="This moves Fajr and Isha. Match whatever your mosque follows."
            >
              <select
                className="field__control"
                value={calc.method}
                onChange={(e) =>
                  dispatch({ type: "setPrayerCalc", method: Number(e.target.value) })
                }
              >
                {PRAYER_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <div style={{ ...dim, marginTop: -8, fontSize: 11.5 }}>
              {PRAYER_METHODS.find((m) => m.id === calc.method)?.detail}
            </div>

            <Field label="Asr" hint="The Hanafi position puts Asr noticeably later.">
              <select
                className="field__control"
                value={calc.school}
                onChange={(e) =>
                  dispatch({ type: "setPrayerCalc", school: Number(e.target.value) as 0 | 1 })
                }
              >
                {ASR_SCHOOLS.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </Field>
            <div style={{ ...dim, marginTop: -8, fontSize: 11.5 }}>
              {ASR_SCHOOLS.find((sc) => sc.id === calc.school)?.detail}
            </div>

            <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Location</div>
              <div style={{ ...dim, marginBottom: 10, fontSize: 11.5 }}>
                {place
                  ? `Using ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}.`
                  : "Not set, so no times can be calculated."}
              </div>
              <Button sm onClick={askLocation} disabled={locating}>
                {locating ? "Asking…" : place ? "Update my location" : "Use my location"}
              </Button>
              <div style={{ ...dim, marginTop: 8, fontSize: 11.5 }}>
                Update this when you travel, or the times will be for where you were.
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div style={dim}>
            {PRAYER_METHODS.find((m) => m.id === calc.method)?.name}
            {" · "}
            {ASR_SCHOOLS.find((sc) => sc.id === calc.school)?.name} Asr
            {place ? "" : " · no location set"}
          </div>
        </Card>
      )}
    </>
  );
}
