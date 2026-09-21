import { useMemo, useState } from "react";
import { Card, ProgressBar, SectionHeader, Tabs } from "../design/primitives";
import { Ring3D } from "../design/Ring3D";
import { BarStrip, Sparkline } from "../design/charts";
import { MetricDetail, type MetricSeriesPoint } from "../design/MetricDetail";
import { useStore } from "../state/store";
import { Journal } from "./Journal";
import { Review } from "./Review";
import { fitnessAge } from "../lib/metrics/fitnessAge";
import { recovery } from "../lib/metrics/recovery";
import { strain as strainMetric } from "../lib/metrics/strain";
import { useToday } from "../state/useToday";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function ProgressOverview() {
  const [range, setRange] = useState<"14" | "30" | "45">("30");
  const [open, setOpen] = useState<null | "recovery" | "strain">(null);

  const { state } = useStore();
  const profile = state.profile;
  // Hooks cannot be called inside a useMemo callback: React has no way to track
  // one there, and the render crashes with "rendered fewer hooks than expected".
  const todayKey = useToday();

  const data = useMemo(() => {
    const all = Object.values(state.health)
      .filter((d) => d.date <= todayKey)
      .sort((a, b) => a.date.localeCompare(b.date));
    const rec = all.map((d, i) => ({
      date: d.date,
      value: recovery(d, all.slice(0, i), profile).score,
    }));
    const str = all.map((d) => ({ date: d.date, value: strainMetric(d, profile).strain }));
    return { all, rec, str };
  }, [state, profile, todayKey]);

  const n = parseInt(range, 10);
  const all = data.all.slice(-n);
  const rec = data.rec.slice(-n);
  const str = data.str.slice(-n);

  const recNums = rec.map((p) => p.value).filter((v): v is number => v != null);
  const avgRec = recNums.length
    ? Math.round(recNums.reduce((a, b) => a + b, 0) / recNums.length)
    : null;
  const totalStrain = str.reduce((a, p) => a + (p.value ?? 0), 0);
  const trainingDays = str.filter((p) => (p.value ?? 0) >= 8).length;
  const totalSteps = all.reduce((a, d) => a + (d.steps ?? 0), 0);
  const avgSleep = (() => {
    const v = all.map((d) => d.sleepHrs).filter((x): x is number => typeof x === "number");
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  })();
  const fitNow = data.all.length
    ? fitnessAge(data.all[data.all.length - 1], data.all.slice(0, -1), profile)
    : null;
  const fitThen = all.length
    ? fitnessAge(all[0], data.all.slice(0, data.all.length - n), profile)
    : null;
  const fitDelta =
    fitNow?.fitnessAge != null && fitThen?.fitnessAge != null
      ? fitNow.fitnessAge - fitThen.fitnessAge
      : null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <Tabs
          tabs={[
            { id: "14", label: "2 weeks" },
            { id: "30", label: "Month" },
            { id: "45", label: "6 weeks" },
          ]}
          value={range}
          onChange={(id) => setRange(id as typeof range)}
        />
      </div>

      <SectionHeader title="Headline" />
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Ring3D
            value={(avgRec ?? 0) / 100}
            size={104}
            thickness={12}
            color="var(--m-recovery)"
            color2="var(--m-recovery-2)"
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{avgRec ?? "—"}</div>
              <div
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  color: "var(--text-dim)",
                }}
              >
                AVG
              </div>
            </div>
          </Ring3D>
          <div style={{ flex: 1, display: "grid", gap: 10 }}>
            <Row label="Training days" value={`${trainingDays}`} sub={`of ${n}`} />
            <Row label="Total effort" value={totalStrain.toFixed(0)} sub="TRIMP-weighted" />
            <Row
              label="Fitness age"
              value={fitNow?.fitnessAge != null ? `${fitNow.fitnessAge}` : "—"}
              sub={
                fitDelta != null
                  ? fitDelta <= 0
                    ? `${fitDelta} yrs`
                    : `+${fitDelta} yrs`
                  : undefined
              }
              good={fitDelta != null ? fitDelta <= 0 : undefined}
            />
          </div>
        </div>
      </Card>

      <SectionHeader title="Recovery trend" />
      <Card chevron onClick={() => setOpen("recovery")} ariaLabel="Recovery history">
        <Sparkline
          values={rec.map((p) => p.value)}
          color="var(--m-recovery)"
          width={300}
          height={64}
          unit="%"
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 10,
            fontSize: 11.5,
          }}
        >
          <span style={{ color: "var(--text-faint)" }}>{n} days</span>
          <span style={{ color: "var(--text-dim)", fontWeight: 600 }}>
            average {avgRec ?? "—"}%
          </span>
        </div>
      </Card>

      <SectionHeader title="Effort" />
      <Card chevron onClick={() => setOpen("strain")} ariaLabel="Effort history">
        <BarStrip
          values={str.map((p) => p.value)}
          color="var(--m-strain)"
          height={64}
          max={21}
          decimals={1}
          format={(v) => `${v.toFixed(1)} / 21`}
        />
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 10 }}>
          Tap any bar for that day&rsquo;s exact effort
        </div>
      </Card>

      <SectionHeader title="Sleep &amp; movement" />
      <div style={{ display: "grid", gap: 12 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Sleep</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {avgSleep ? `${avgSleep.toFixed(1)}h avg` : "—"}
            </span>
          </div>
          <BarStrip
            values={all.map((d) => d.sleepHrs ?? null)}
            color="var(--m-sleep)"
            height={52}
            max={10}
            format={(v) => `${v.toFixed(1)} hours`}
          />
          <div style={{ marginTop: 12 }}>
            <ProgressBar
              value={(avgSleep ?? 0) / 8}
              color="var(--m-sleep)"
              ariaLabel="Sleep vs need"
            />
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>
              {avgSleep
                ? `${Math.round((avgSleep / 8) * 100)}% of an 8-hour target`
                : "No sleep data"}
            </div>
          </div>
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Steps</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {totalSteps.toLocaleString()} total
            </span>
          </div>
          <BarStrip
            values={all.slice(-14).map((d) => d.steps ?? null)}
            labels={all.slice(-14).map((d) => DOW[new Date(d.date + "T12:00:00").getDay()])}
            color="var(--m-strain)"
            height={56}
            format={(v) => v.toLocaleString() + " steps"}
          />
        </Card>
      </div>

      {open === "recovery" && (
        <MetricDetail
          title="Recovery"
          unit="%"
          color="var(--m-recovery)"
          goodDirection="up"
          series={data.rec as MetricSeriesPoint[]}
          onClose={() => setOpen(null)}
          explanation="Your daily recovery score over time. Sustained highs mean you're absorbing your training; a run of lows means the load is outpacing your recovery — take an easier few days and watch it climb back."
        />
      )}
      {open === "strain" && (
        <MetricDetail
          title="Effort"
          decimals={1}
          color="var(--m-strain)"
          series={data.str as MetricSeriesPoint[]}
          onClose={() => setOpen(null)}
          explanation="Daily cardiovascular effort on the 0–21 TRIMP scale. Consistency beats heroics — a steady rhythm of moderate days with occasional hard ones builds fitness faster than sporadic maximum efforts."
        />
      )}
    </>
  );
}

function Row({
  label,
  value,
  sub,
  good,
}: {
  label: string;
  value: string;
  sub?: string;
  good?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {value}
        {sub && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              marginLeft: 5,
              color: good == null ? "var(--text-faint)" : good ? "var(--m-habits)" : "var(--warn)",
            }}
          >
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * Progress gathers everything backward-looking: the overview, the weekly
 * review with today's focus list and badges, and the journal.
 */
export function Progress() {
  const [sub, setSub] = useState<"overview" | "review" | "journal">("overview");

  return (
    <>
      <Tabs<"overview" | "review" | "journal">
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "review", label: "Review" },
          { id: "journal", label: "Journal" },
        ]}
        value={sub}
        onChange={setSub}
      />
      {sub === "overview" && <ProgressOverview />}
      {sub === "review" && <Review />}
      {sub === "journal" && <Journal />}
    </>
  );
}
