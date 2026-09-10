import { useMemo, useState } from "react";
import { Card, ProgressBar, Ring, SectionHeader, Tabs } from "../design/primitives";
import { BarStrip, Sparkline } from "../design/charts";
import { MetricDetail, type MetricSeriesPoint } from "../design/MetricDetail";
import { DEMO_PROFILE, demoHistory } from "../lib/demoData";
import { fitnessAge } from "../lib/metrics/fitnessAge";
import { recovery } from "../lib/metrics/recovery";
import { strain as strainMetric } from "../lib/metrics/strain";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function Progress() {
  const [range, setRange] = useState<"14" | "30" | "45">("30");
  const [open, setOpen] = useState<null | "recovery" | "strain">(null);

  const data = useMemo(() => {
    const all = demoHistory(45);
    const rec = all.map((d, i) => ({
      date: d.date,
      value: recovery(d, all.slice(0, i), DEMO_PROFILE).score,
    }));
    const str = all.map((d) => ({ date: d.date, value: strainMetric(d, DEMO_PROFILE).strain }));
    return { all, rec, str };
  }, []);

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
  const fitNow = fitnessAge(data.all[data.all.length - 1], data.all.slice(0, -1), DEMO_PROFILE);
  const fitThen = fitnessAge(all[0], data.all.slice(0, data.all.length - n), DEMO_PROFILE);
  const fitDelta =
    fitNow.fitnessAge != null && fitThen.fitnessAge != null
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
          <Ring value={(avgRec ?? 0) / 100} size={92} stroke={9} color="var(--m-recovery)">
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
          </Ring>
          <div style={{ flex: 1, display: "grid", gap: 10 }}>
            <Row label="Training days" value={`${trainingDays}`} sub={`of ${n}`} />
            <Row label="Total effort" value={totalStrain.toFixed(0)} sub="TRIMP-weighted" />
            <Row
              label="Fitness age"
              value={fitNow.fitnessAge != null ? `${fitNow.fitnessAge}` : "—"}
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
