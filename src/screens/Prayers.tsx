/**
 * The prayers section: today's five, the streak, and the debt ledger.
 *
 * Times need a location and a network; tracking needs neither. If the times are
 * unavailable the five still tap, the streak still counts and the debt still
 * clears — the countdown card is the only thing that goes quiet.
 */

import { useEffect, useMemo, useState } from "react";
import { tick } from "../design/charts";
import { Badge, Button, Card, SectionHeader } from "../design/primitives";
import { ymd } from "../lib/dates";
import {
  cachedTimes,
  fetchPrayerTimes,
  formatIn,
  locate,
  nextPrayer,
  prayerConsistency,
  prayerStreak,
} from "../lib/prayer";
import { PRAYERS, prayersDoneOn, prayerDebtTotal } from "../state/schema";
import { useStore } from "../state/store";

function shift(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export function Prayers() {
  const { state, dispatch } = useStore();
  const today = ymd(new Date());
  const place = state.place;

  const [times, setTimes] = useState<Record<string, string> | null>(() =>
    place ? (cachedTimes(today, place)?.times ?? null) : null,
  );
  const [locating, setLocating] = useState(false);
  const [timesError, setTimesError] = useState<string | null>(null);
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  // Keep the countdown honest without re-rendering the whole screen every second.
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!place) return;
    let cancelled = false;
    void fetchPrayerTimes(today, place).then((r) => {
      if (cancelled) return;
      if (r) setTimes(r.times);
      else setTimesError("Could not reach the prayer-times service. Tracking still works.");
    });
    return () => {
      cancelled = true;
    };
  }, [place, today]);

  const doneToday = state.prayers.done[today] ?? {};
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

  return (
    <>
      {/* ── Next prayer ─────────────────────────────────────────────────── */}
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
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{next.name}</div>
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
        </Card>
      ) : (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Prayer times</div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-dim)",
              lineHeight: 1.6,
              margin: "6px 0 12px",
            }}
          >
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

      {/* ── Today ───────────────────────────────────────────────────────── */}
      <SectionHeader
        title="Today"
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
            return (
              <button
                key={p.id}
                className="prayerrow"
                aria-pressed={done}
                onClick={() => {
                  tick();
                  dispatch({ type: "togglePrayer", date: today, prayerId: p.id });
                }}
              >
                <span className="prayerrow__icon" aria-hidden>
                  {p.icon}
                </span>
                <span className="prayerrow__body">
                  <span className="prayerrow__name">{p.name}</span>
                  <span className="prayerrow__detail">
                    {times?.[p.id] ? times[p.id] : p.detail}
                  </span>
                </span>
                <span className={`prayerrow__check${done ? " is-done" : ""}`} aria-hidden>
                  {done ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Consistency ─────────────────────────────────────────────────── */}
      <SectionHeader title="Consistency" />
      <Card>
        <div style={{ display: "flex", gap: 20 }}>
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

      {/* ── Debt ────────────────────────────────────────────────────────── */}
      <SectionHeader
        title="Missed prayers"
        right={
          <Badge tone={debtTotal > 0 ? "warn" : "accent"}>
            {debtTotal > 0 ? `${debtTotal} owed` : "All clear"}
          </Badge>
        }
      />
      <Card>
        <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 14 }}>
          Prayers you owe, repaid by praying extras on top of the five. Set the count once and knock
          it down as you go.
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {PRAYERS.map((p) => {
            const owed = Math.max(0, state.prayers.debt[p.id] ?? 0);
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
                {owed > 0 ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1, 5].map((n) => (
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
                  </div>
                ) : (
                  <Button
                    sm
                    onClick={() => dispatch({ type: "setPrayerDebt", prayerId: p.id, count: 1 })}
                  >
                    Add
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
