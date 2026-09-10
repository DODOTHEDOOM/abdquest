import { useMemo, useState } from "react";
import { Badge, Card, ProgressBar, Ring, SectionHeader, Sheet } from "../design/primitives";
import { BarStrip, Sparkline, ZoneBar } from "../design/charts";
import { DEMO_PROFILE, demoHistory } from "../lib/demoData";
import { fitnessAge } from "../lib/metrics/fitnessAge";
import { fmtHrs, recovery } from "../lib/metrics/recovery";
import { sleep as sleepMetric } from "../lib/metrics/sleep";
import { strain as strainMetric } from "../lib/metrics/strain";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function Dashboard() {
  const [detail, setDetail] = useState<null | "recovery" | "fitness">(null);

  const m = useMemo(() => {
    const all = demoHistory(45);
    const today = all[all.length - 1];
    const history = all.slice(0, -1);
    const rec = recovery(today, history, DEMO_PROFILE);
    const str = strainMetric(today, DEMO_PROFILE);
    const slp = sleepMetric(today, history, DEMO_PROFILE, str.strain);
    const fit = fitnessAge(today, history, DEMO_PROFILE);
    const last14 = all.slice(-14);
    const last7 = all.slice(-7);
    return { all, today, history, rec, str, slp, fit, last14, last7 };
  }, []);

  const { today, rec, str, slp, fit, last14, last7 } = m;
  const recPct = rec.score != null ? rec.score / 100 : 0;

  return (
    <>
      <SectionHeader
        title="Today"
        action="How it's measured"
        onAction={() => setDetail("recovery")}
      />

      {/* ── Hero: recovery + strain + sleep ─────────────────────────────── */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Ring value={recPct} size={116} stroke={11} color="var(--m-recovery)">
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {rec.score ?? "—"}
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-faint)" }}>%</span>
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "var(--text-dim)",
                  marginTop: 2,
                }}
              >
                RECOVERY
              </div>
            </div>
          </Ring>
          <div style={{ flex: 1, display: "grid", gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{rec.label}</div>
            <HeroStat
              label="Effort today"
              value={str.strain.toFixed(1)}
              suffix="/ 21"
              sub={str.label}
              color="var(--m-strain)"
              pct={str.strain / 21}
            />
            <HeroStat
              label="Sleep"
              value={slp.actualHrs ? fmtHrs(slp.actualHrs) : "—"}
              sub={`${Math.round((slp.performance ?? 0) * 100)}% of ${fmtHrs(slp.needHrs)} need`}
              color="var(--m-sleep)"
              pct={slp.performance ?? 0}
            />
          </div>
        </div>
      </Card>

      {/* ── Fitness age ─────────────────────────────────────────────────── */}
      <SectionHeader
        title="Fitness age"
        action="How it's measured"
        onAction={() => setDetail("fitness")}
      />
      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontSize: 44,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: "var(--m-fitness)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fit.fitnessAge ?? "—"}
              </span>
              <span style={{ fontSize: 14, color: "var(--text-dim)" }}>years</span>
            </div>
            <div style={{ marginTop: 8 }}>
              {fit.delta != null && (
                <Badge tone={fit.delta <= 0 ? "accent" : "warn"}>
                  {fit.delta <= 0 ? "▼" : "▲"} {fit.label}
                </Badge>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 10 }}>
              VO₂max {fit.vo2max ?? "—"} ml/kg/min
              <span style={{ opacity: 0.7 }}>
                {" "}
                · {fit.vo2Source === "device" ? "from your watch" : "estimated"}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right", width: 120, flexShrink: 0 }}>
            <Sparkline
              values={last14.map((d) => d.vo2max ?? null)}
              color="var(--m-fitness)"
              width={110}
              height={44}
            />
            <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 4 }}>
              VO₂max · 14 days
            </div>
          </div>
        </div>
      </Card>

      {/* ── Vitals ──────────────────────────────────────────────────────── */}
      <SectionHeader title="Vitals" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <VitalTile
          label="Resting HR"
          value={today.rhr}
          unit="bpm"
          color="var(--m-recovery)"
          series={last14.map((d) => d.rhr ?? null)}
          goodDirection="down"
        />
        <VitalTile
          label="HRV"
          value={today.hrv}
          unit="ms"
          color="var(--m-strain)"
          series={last14.map((d) => d.hrv ?? null)}
          goodDirection="up"
        />
        <VitalTile
          label="Respiratory"
          value={today.resp}
          unit="br/min"
          color="var(--m-sleep)"
          series={last14.map((d) => d.resp ?? null)}
          decimals={1}
        />
        <VitalTile
          label="Blood oxygen"
          value={today.spo2}
          unit="%"
          color="var(--m-fitness)"
          series={last14.map((d) => d.spo2 ?? null)}
        />
      </div>

      {/* ── Effort breakdown ────────────────────────────────────────────── */}
      <SectionHeader title="Effort" />
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Heart-rate zones today</span>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
            {str.source === "hr" ? "from HR series" : "estimated"}
          </span>
        </div>
        {str.zoneMins ? (
          <>
            <ZoneBar mins={str.zoneMins} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              {str.zoneMins.map((v, i) => (
                <div key={i} style={{ textAlign: "center", flex: 1 }}>
                  <div
                    style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
                  >
                    {Math.round(v)}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--text-faint)" }}>Z{i + 1}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-faint)" }}>
            No heart-rate data for today yet.
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              marginBottom: 6,
            }}
          >
            <span style={{ color: "var(--text-dim)" }}>Steps · last 7 days</span>
            <span style={{ fontWeight: 600 }}>{(today.steps ?? 0).toLocaleString()} today</span>
          </div>
          <BarStrip
            values={last7.map((d) => d.steps ?? null)}
            labels={last7.map((d) => DOW[new Date(d.date + "T12:00:00").getDay()])}
            color="var(--m-strain)"
          />
        </div>
      </Card>

      {/* ── Sleep ───────────────────────────────────────────────────────── */}
      <SectionHeader title="Sleep" />
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 700 }}>{slp.label}</span>
          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
            {Math.round((slp.performance ?? 0) * 100)}%
          </span>
        </div>
        <ProgressBar
          value={slp.performance ?? 0}
          color="var(--m-sleep)"
          ariaLabel="Sleep performance"
        />
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}
        >
          <MiniStat label="Need" value={fmtHrs(slp.needHrs)} />
          <MiniStat
            label="Debt"
            value={`${slp.debtHrs}h`}
            tone={slp.debtHrs > 3 ? "warn" : undefined}
          />
          <MiniStat
            label="Consistency"
            value={slp.consistency != null ? `${Math.round(slp.consistency * 100)}%` : "—"}
            sub={slp.bedtimeSdMins != null ? `±${slp.bedtimeSdMins}m` : undefined}
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <BarStrip
            values={last14.map((d) => d.sleepHrs ?? null)}
            color="var(--m-sleep)"
            height={44}
            max={10}
          />
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 6 }}>
            Hours slept · 14 nights
          </div>
        </div>
      </Card>

      {/* ── Detail sheets ───────────────────────────────────────────────── */}
      {detail === "recovery" && (
        <Sheet
          title="Recovery"
          sub="Built from your own rolling baseline"
          onClose={() => setDetail(null)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            {rec.components.map((c) => (
              <div key={c.key}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{c.label}</span>
                  <span style={{ color: "var(--text-dim)" }}>{c.display}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--text-faint)",
                    margin: "3px 0 6px",
                  }}
                >
                  <span>{c.context ?? ""}</span>
                  <span>
                    {c.score == null
                      ? "no data — excluded"
                      : `${Math.round(c.score * 100)}% · weight ${Math.round((c.weight / rec.coverage) * 100)}%`}
                  </span>
                </div>
                <ProgressBar value={c.score ?? 0} color="var(--m-recovery)" />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.6, marginTop: 18 }}>
            Method: HRV and resting heart rate are compared against your own 30-day rolling baseline
            (the standard HRV-guided readiness approach — Plews et al., Buchheit), then blended with
            sleep performance and respiratory rate. Inputs without data are dropped and the rest
            re-weighted. An estimate, not medical advice.
          </p>
        </Sheet>
      )}

      {detail === "fitness" && (
        <Sheet
          title="Fitness age"
          sub="Your cardio fitness vs population norms"
          onClose={() => setDetail(null)}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <MiniRow label="VO₂max" value={`${fit.vo2max ?? "—"} ml/kg/min`} />
            <MiniRow
              label="Source"
              value={fit.vo2Source === "device" ? "Your watch" : "Estimated from your data"}
            />
            <MiniRow label="Chronological age" value={`${DEMO_PROFILE.age}`} />
            <MiniRow label="Fitness age" value={`${fit.fitnessAge ?? "—"}`} />
          </div>
          <p style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.6, marginTop: 18 }}>
            Method: your VO₂max is compared against published age-and-sex population medians, and
            your fitness age is the age at which your VO₂max would be typical (Nes et al., HUNT
            fitness-age study). When your watch doesn&rsquo;t report VO₂max we estimate it from age,
            BMI and your logged activity using the Jackson non-exercise regression. A population
            estimate, not a clinical measurement.
          </p>
        </Sheet>
      )}
    </>
  );
}

function HeroStat({
  label,
  value,
  suffix,
  sub,
  color,
  pct,
}: {
  label: string;
  value: string;
  suffix?: string;
  sub: string;
  color: string;
  pct: number;
}) {
  return (
    <div>
      <div
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)" }}>{label}</span>
        <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {value}
          {suffix && (
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>
              {" "}
              {suffix}
            </span>
          )}
        </span>
      </div>
      <div style={{ margin: "5px 0 3px" }}>
        <ProgressBar value={pct} color={color} ariaLabel={label} />
      </div>
      <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{sub}</div>
    </div>
  );
}

function VitalTile({
  label,
  value,
  unit,
  color,
  series,
  decimals = 0,
  goodDirection,
}: {
  label: string;
  value?: number;
  unit: string;
  color: string;
  series: (number | null)[];
  decimals?: number;
  goodDirection?: "up" | "down";
}) {
  const clean = series.filter((v): v is number => typeof v === "number");
  const prior = clean.slice(0, -1);
  const avg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
  const diff = value != null && avg != null ? value - avg : null;
  const good = diff == null || !goodDirection ? null : goodDirection === "up" ? diff > 0 : diff < 0;

  return (
    <Card>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {value != null ? value.toFixed(decimals) : "—"}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{unit}</span>
      </div>
      {diff != null && (
        <div
          style={{
            fontSize: 10.5,
            marginTop: 2,
            color: good == null ? "var(--text-faint)" : good ? "var(--m-habits)" : "var(--warn)",
            fontWeight: 600,
          }}
        >
          {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(decimals || 1)} vs 14-day avg
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <Sparkline values={series} color={color} width={140} height={30} />
      </div>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn";
}) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--text-dim)", fontWeight: 600 }}>{label}</div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: tone === "warn" ? "var(--warn)" : "var(--text)",
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{sub}</div>}
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
      <span style={{ color: "var(--text-dim)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
