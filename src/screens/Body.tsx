/**
 * Body: weight, water, food and sleep — the things you log by hand.
 *
 * Anything a watch already synced is shown as synced and can still be
 * corrected here; a manual entry always wins, because you were there and the
 * watch was guessing.
 */

import { useMemo, useState } from "react";
import { BarStrip, Sparkline, tick } from "../design/charts";
import { Button, Card, Field, ProgressBar, SectionHeader, TextInput } from "../design/primitives";
import {
  averageOf,
  carryForward,
  hoursBetween,
  seriesFor,
  targetStreak,
  towardTarget,
  weightTrend,
  type DatedValue,
} from "../lib/body";
import { fmtHrs } from "../lib/metrics/recovery";
import type { SleepStages } from "../lib/metrics/types";
import { useStore } from "../state/store";
import { useToday } from "../state/useToday";

function signed(n: number, unit: string, decimals = 1): string {
  const r = Math.abs(n) < 0.05 ? 0 : n;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(decimals)}${unit}`;
}

/** A number typed by hand, or undefined when the box is empty or nonsense. */
function parsed(raw: string, min: number, max: number): number | undefined {
  const n = Number(raw);
  return raw.trim() && isFinite(n) && n >= min && n <= max ? n : undefined;
}

/** Minutes per stage as one proportional bar, in the order sleep moves through. */
const STAGE_ORDER = [
  { key: "deep", label: "Deep", color: "var(--m-fitness)" },
  { key: "rem", label: "REM", color: "var(--m-sleep)" },
  { key: "light", label: "Light", color: "var(--m-recovery)" },
  { key: "restless", label: "Restless", color: "var(--m-strain)" },
  { key: "awake", label: "Awake", color: "var(--text-faint)" },
] as const;

function SleepStageBar({ stages }: { stages: SleepStages }) {
  const parts = STAGE_ORDER.map((s) => ({ ...s, mins: stages[s.key] ?? 0 })).filter(
    (s) => s.mins > 0,
  );
  const total = parts.reduce((a, b) => a + b.mins, 0);
  if (!total) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", gap: 2 }}
        role="img"
        aria-label={parts.map((p) => `${p.label} ${p.mins} minutes`).join(", ")}
      >
        {parts.map((p) => (
          <span key={p.key} style={{ flex: p.mins, background: p.color }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
        {parts.map((p) => (
          <span
            key={p.key}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}
          >
            <span
              aria-hidden
              style={{ width: 8, height: 8, borderRadius: 3, background: p.color }}
            />
            <span style={{ color: "var(--text-dim)" }}>{p.label}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {Math.floor(p.mins / 60)}h {String(p.mins % 60).padStart(2, "0")}m
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** The readings worth being able to correct by hand, with sane bounds. */
const READINGS = [
  { key: "sleepHrs", label: "Sleep", unit: " h", step: "0.1", min: 0, max: 24 },
  { key: "rhr", label: "Resting heart rate", unit: " bpm", step: "1", min: 25, max: 200 },
  { key: "hrv", label: "Heart-rate variability", unit: " ms", step: "1", min: 3, max: 250 },
  { key: "steps", label: "Steps", unit: "", step: "100", min: 0, max: 200000 },
  { key: "calOut", label: "Calories burned", unit: " kcal", step: "50", min: 0, max: 20000 },
] as const;

export function Body() {
  const { state, dispatch } = useStore();
  const today = useToday();
  const p = state.profile;

  const [wt, setWt] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [bed, setBed] = useState("");
  const [wake, setWake] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [fixEdit, setFixEdit] = useState<Record<string, string>>({});

  const say = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2000);
  };

  const weightVals: DatedValue[] = useMemo(
    () => state.weight.map((e) => ({ date: e.date, value: e.kg })),
    [state.weight],
  );
  const waterVals: DatedValue[] = useMemo(
    () => state.water.map((e) => ({ date: e.date, value: e.ml })),
    [state.water],
  );
  const kcalVals: DatedValue[] = useMemo(
    () => state.calories.map((e) => ({ date: e.date, value: e.kcal })),
    [state.calories],
  );
  const sleepVals: DatedValue[] = useMemo(
    () =>
      Object.values(state.health)
        .filter((d) => typeof d.sleepHrs === "number" && d.sleepHrs > 0)
        .map((d) => ({ date: d.date, value: d.sleepHrs as number })),
    [state.health],
  );

  const trend = useMemo(
    () => weightTrend(weightVals, today, 30, p.weightTargetKg),
    [weightVals, today, p.weightTargetKg],
  );
  const weightSeries = useMemo(() => seriesFor(weightVals, today, 30), [weightVals, today]);
  const weightLine = useMemo(() => carryForward(weightSeries), [weightSeries]);
  const waterToday = waterVals.find((e) => e.date === today)?.value ?? 0;
  const waterPct = towardTarget(waterToday, p.waterTargetMl);
  const waterRun = useMemo(
    () => targetStreak(waterVals, today, p.waterTargetMl, 30),
    [waterVals, today, p.waterTargetMl],
  );
  const kcalToday = state.calories.find((e) => e.date === today);
  const kcalPct = towardTarget(kcalToday?.kcal ?? 0, p.kcalTarget);
  const sleepSeries = useMemo(() => seriesFor(sleepVals, today, 14), [sleepVals, today]);
  const sleepAvg = averageOf(sleepSeries);
  const lastNight = sleepVals.find((e) => e.date === today)?.value ?? null;
  // Last night's breakdown if the watch recorded one, else the most recent.
  const lastStages = useMemo(() => {
    const dates = Object.keys(state.health).sort().reverse();
    for (const d of dates) {
      const st = state.health[d]?.sleepStages;
      if (st && Object.keys(st).length) return st;
    }
    return null;
  }, [state.health]);

  const addWater = (ml: number) => {
    tick();
    dispatch({ type: "addWater", date: today, ml: waterToday + ml });
  };

  const logSleep = () => {
    const hrs = hoursBetween(bed, wake);
    if (hrs === null) return say("Enter both times as HH:MM");
    dispatch({
      type: "mergeHealth",
      date: today,
      day: { date: today, sleepHrs: hrs },
      source: "manual",
    });
    setBed("");
    setWake("");
    say(`Logged ${fmtHrs(hrs)}`);
  };

  return (
    <>
      {/* ── Weight ──────────────────────────────────────────────────────── */}
      <SectionHeader title="Weight" />
      <Card>
        {trend.latest === null ? (
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
            Nothing weighed in yet. Add one below and the trend builds from there.
          </div>
        ) : (
          <>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}
            >
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>
                  {trend.latest.toFixed(1)}
                  <span style={{ fontSize: 15, color: "var(--text-dim)", fontWeight: 600 }}>
                    {" "}
                    kg
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 5 }}>
                  {trend.latestDate === today ? "Today" : trend.latestDate}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {trend.trend !== null && (
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: trend.trend < 0 ? "var(--m-recovery)" : "var(--text-dim)",
                    }}
                  >
                    {signed(trend.trend, " kg")}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 3 }}>
                  {trend.trend !== null ? "30-day trend" : "trend needs a few more"}
                </div>
              </div>
            </div>
            {weightLine.length >= 2 && (
              <div style={{ marginTop: 14 }}>
                <Sparkline
                  values={weightLine}
                  color="var(--m-fitness)"
                  height={46}
                  unit=" kg"
                  decimals={1}
                  interactive
                />
              </div>
            )}
            {trend.toTarget !== null && (
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 12 }}>
                {Math.abs(trend.toTarget) < 0.05
                  ? "You are at your target."
                  : `${Math.abs(trend.toTarget).toFixed(1)} kg ${trend.toTarget > 0 ? "above" : "below"} your target of ${p.weightTargetKg} kg.`}
              </div>
            )}
          </>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 16 }}>
          <div style={{ flex: 1 }}>
            <Field label="Weigh in (kg)">
              <TextInput
                type="number"
                inputMode="decimal"
                step="0.1"
                value={wt}
                placeholder={trend.latest ? String(trend.latest) : "0.0"}
                onChange={(e) => setWt(e.target.value)}
              />
            </Field>
          </div>
          <Button
            variant="primary"
            disabled={parsed(wt, 20, 400) === undefined}
            onClick={() => {
              const kg = parsed(wt, 20, 400);
              if (kg === undefined) return;
              dispatch({ type: "addWeight", date: today, kg });
              dispatch({ type: "setProfile", patch: { weightKg: kg } });
              setWt("");
              say("Weight logged");
            }}
          >
            Log
          </Button>
        </div>
      </Card>

      {/* ── Water ───────────────────────────────────────────────────────── */}
      <SectionHeader title="Water" />
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>
            {(waterToday / 1000).toFixed(1)}
            <span style={{ fontSize: 14, color: "var(--text-dim)", fontWeight: 600 }}> L</span>
          </div>
          {p.waterTargetMl ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              of {(p.waterTargetMl / 1000).toFixed(1)} L
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>no target set</div>
          )}
        </div>
        {waterPct !== null && (
          <div style={{ marginTop: 12 }}>
            <ProgressBar value={waterPct} color="var(--m-sleep)" />
            {waterRun.current > 0 && (
              <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 8 }}>
                {waterRun.current} day{waterRun.current === 1 ? "" : "s"} in a row on target ·{" "}
                {waterRun.hits} of the last {waterRun.days}
              </div>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {[250, 500, 750].map((ml) => (
            <Button key={ml} sm onClick={() => addWater(ml)}>
              +{ml} ml
            </Button>
          ))}
          {waterToday > 0 && (
            <Button
              sm
              onClick={() => {
                dispatch({ type: "addWater", date: today, ml: 0 });
                say("Water reset for today");
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </Card>

      {/* ── Food ────────────────────────────────────────────────────────── */}
      <SectionHeader title="Food" />
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>
            {kcalToday?.kcal ?? 0}
            <span style={{ fontSize: 14, color: "var(--text-dim)", fontWeight: 600 }}> kcal</span>
          </div>
          {kcalToday?.protein ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {kcalToday.protein} g protein
            </div>
          ) : null}
        </div>
        {kcalPct !== null && (
          <div style={{ marginTop: 12 }}>
            <ProgressBar value={kcalPct} color="var(--m-strain)" />
            <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 8 }}>
              Target {p.kcalTarget} kcal
            </div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <Field label="Calories">
            <TextInput
              type="number"
              inputMode="numeric"
              value={kcal}
              placeholder={String(kcalToday?.kcal ?? "")}
              onChange={(e) => setKcal(e.target.value)}
            />
          </Field>
          <Field label="Protein (g)">
            <TextInput
              type="number"
              inputMode="numeric"
              value={protein}
              placeholder={String(kcalToday?.protein ?? "")}
              onChange={(e) => setProtein(e.target.value)}
            />
          </Field>
        </div>
        <Button
          block
          variant="primary"
          style={{ marginTop: 12 }}
          disabled={parsed(kcal, 1, 20000) === undefined}
          onClick={() => {
            const c = parsed(kcal, 1, 20000);
            if (c === undefined) return;
            dispatch({
              type: "addCalories",
              date: today,
              kcal: c,
              protein: parsed(protein, 0, 1000),
            });
            setKcal("");
            setProtein("");
            say("Food logged");
          }}
        >
          Log today
        </Button>
        {kcalVals.length > 1 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginBottom: 8 }}>
              Last 14 days — tap a bar
            </div>
            <BarStrip
              values={seriesFor(kcalVals, today, 14)}
              color="var(--m-strain)"
              height={52}
              unit=" kcal"
            />
          </div>
        )}
      </Card>

      {/* ── Sleep ───────────────────────────────────────────────────────── */}
      <SectionHeader title="Sleep" />
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>
            {lastNight !== null ? fmtHrs(lastNight) : "—"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {sleepAvg !== null ? `${fmtHrs(sleepAvg)} average` : "no nights yet"}
          </div>
        </div>
        {lastStages && <SleepStageBar stages={lastStages} />}

        {sleepSeries.some((x) => x !== null) && (
          <div style={{ marginTop: 14 }}>
            <BarStrip
              values={sleepSeries}
              color="var(--m-sleep)"
              height={52}
              unit="h"
              decimals={1}
            />
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <Field label="Asleep at">
            <TextInput type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
          </Field>
          <Field label="Woke at">
            <TextInput type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
          </Field>
        </div>
        <Button block variant="primary" style={{ marginTop: 12 }} onClick={logSleep}>
          Log last night
        </Button>
      </Card>

      {/* ── Corrections ─────────────────────────────────────────────────── */}
      <SectionHeader title="Today's readings" />
      <Card>
        <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 14 }}>
          What your watch reported. If one of these is plainly wrong, correct it here and the
          correction will stick: later syncs leave a corrected value alone.
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {READINGS.map((r) => {
            const day = state.health[today];
            const value = day?.[r.key] as number | undefined;
            const corrected = (day?.manual ?? []).includes(r.key);
            const editing = fixEdit[r.key] !== undefined;
            return (
              <div
                key={r.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "var(--surface-2)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                    {value === undefined ? "Nothing synced" : `${value}${r.unit}`}
                    {corrected && (
                      <span style={{ color: "var(--m-recovery)" }}> &middot; corrected</span>
                    )}
                  </div>
                </div>

                {editing ? (
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ width: 82 }}>
                      <TextInput
                        type="number"
                        inputMode="decimal"
                        step={r.step}
                        value={fixEdit[r.key]}
                        aria-label={`Correct ${r.label}`}
                        onChange={(e) => setFixEdit({ ...fixEdit, [r.key]: e.target.value })}
                      />
                    </span>
                    <Button
                      sm
                      variant="primary"
                      onClick={() => {
                        const n = parsed(fixEdit[r.key], r.min, r.max);
                        if (n !== undefined) {
                          dispatch({
                            type: "mergeHealth",
                            date: today,
                            day: { date: today, [r.key]: n },
                            source: "manual",
                          });
                          say(`${r.label} corrected`);
                        }
                        const rest = { ...fixEdit };
                        delete rest[r.key];
                        setFixEdit(rest);
                      }}
                    >
                      Set
                    </Button>
                  </span>
                ) : (
                  <span style={{ display: "flex", gap: 6 }}>
                    {corrected && (
                      <Button
                        sm
                        onClick={() => {
                          dispatch({ type: "clearHealthField", date: today, field: r.key });
                          say(`${r.label} back to whatever syncs next`);
                        }}
                      >
                        Undo
                      </Button>
                    )}
                    <Button
                      sm
                      onClick={() =>
                        setFixEdit({
                          ...fixEdit,
                          [r.key]: value === undefined ? "" : String(value),
                        })
                      }
                    >
                      {value === undefined ? "Add" : "Correct"}
                    </Button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Targets ─────────────────────────────────────────────────────── */}
      <SectionHeader title="Targets" />
      <Card>
        <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 14 }}>
          Leave any of these blank and the app simply will not show a target for it.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Goal weight (kg)">
            <TextInput
              type="number"
              inputMode="decimal"
              step="0.5"
              value={p.weightTargetKg ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "setProfile",
                  patch: { weightTargetKg: parsed(e.target.value, 20, 400) },
                })
              }
            />
          </Field>
          <Field label="Water (ml)">
            <TextInput
              type="number"
              inputMode="numeric"
              step="250"
              value={p.waterTargetMl ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "setProfile",
                  patch: { waterTargetMl: parsed(e.target.value, 250, 10000) },
                })
              }
            />
          </Field>
          <Field label="Calories">
            <TextInput
              type="number"
              inputMode="numeric"
              step="50"
              value={p.kcalTarget ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "setProfile",
                  patch: { kcalTarget: parsed(e.target.value, 500, 10000) },
                })
              }
            />
          </Field>
          <Field label="Protein (g)">
            <TextInput
              type="number"
              inputMode="numeric"
              step="5"
              value={p.proteinTargetG ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "setProfile",
                  patch: { proteinTargetG: parsed(e.target.value, 20, 500) },
                })
              }
            />
          </Field>
        </div>
      </Card>

      {flash && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 88,
            transform: "translateX(-50%)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "8px 16px",
            fontSize: 12.5,
            zIndex: 40,
          }}
        >
          {flash}
        </div>
      )}
    </>
  );
}
