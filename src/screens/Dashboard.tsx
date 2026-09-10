import { useMemo, useState } from "react";
import { Badge, Card, ProgressBar, Ring, SectionHeader, Sheet } from "../design/primitives";
import { BarStrip, Sparkline, ZoneBar, tick } from "../design/charts";
import { MetricDetail, shortDate, type MetricSeriesPoint } from "../design/MetricDetail";
import { DEMO_PROFILE, demoHistory } from "../lib/demoData";
import { fitnessAge } from "../lib/metrics/fitnessAge";
import { fmtHrs, recovery } from "../lib/metrics/recovery";
import { sleep as sleepMetric } from "../lib/metrics/sleep";
import { strain as strainMetric } from "../lib/metrics/strain";
import type { DailyHealth } from "../lib/metrics/types";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

type Detail =
  | null
  | { kind: "recovery" }
  | { kind: "fitness" }
  | { kind: "strain" }
  | { kind: "sleep" }
  | { kind: "vital"; id: VitalId };

type VitalId = "rhr" | "hrv" | "resp" | "spo2";

const VITALS: {
  id: VitalId;
  label: string;
  unit: string;
  color: string;
  decimals: number;
  pick: (d: DailyHealth) => number | undefined;
  goodDirection?: "up" | "down";
  explanation: string;
}[] = [
  {
    id: "rhr",
    label: "Resting HR",
    unit: " bpm",
    color: "var(--m-recovery)",
    decimals: 0,
    pick: (d) => d.rhr,
    goodDirection: "down",
    explanation:
      "Your heart rate at complete rest. It drops as your cardiovascular fitness improves, and rises temporarily when you're under-recovered, ill, dehydrated or stressed. A single day means little — the trend is what matters.",
  },
  {
    id: "hrv",
    label: "HRV",
    unit: " ms",
    color: "var(--m-strain)",
    decimals: 0,
    pick: (d) => d.hrv,
    goodDirection: "up",
    explanation:
      "The variation in time between heartbeats. Higher generally means your nervous system is well recovered and adaptable; a sharp drop below your own baseline is an early sign of fatigue, illness or heavy training load. HRV is naturally noisy day to day, so compare against your baseline, not against other people.",
  },
  {
    id: "resp",
    label: "Respiratory",
    unit: " br/min",
    color: "var(--m-sleep)",
    decimals: 1,
    pick: (d) => d.resp,
    explanation:
      "Breaths per minute while you sleep. It's remarkably stable night to night, which is exactly why a jump above your normal is a useful early warning that something is off — often illness before you feel symptoms.",
  },
  {
    id: "spo2",
    label: "Blood oxygen",
    unit: "%",
    color: "var(--m-fitness)",
    decimals: 0,
    pick: (d) => d.spo2,
    goodDirection: "up",
    explanation:
      "The percentage of oxygen your blood is carrying, measured overnight. Healthy readings usually sit in the mid-90s and above. Consumer sensors are not medical grade — treat persistent low readings as a reason to talk to a doctor, not a diagnosis.",
  },
];

export function Dashboard() {
  const [detail, setDetail] = useState<Detail>(null);

  const m = useMemo(() => {
    const all = demoHistory(45);
    const today = all[all.length - 1];
    const history = all.slice(0, -1);
    const str = strainMetric(today, DEMO_PROFILE);
    return {
      all,
      today,
      history,
      rec: recovery(today, history, DEMO_PROFILE),
      str,
      slp: sleepMetric(today, history, DEMO_PROFILE, str.strain),
      fit: fitnessAge(today, history, DEMO_PROFILE),
      last14: all.slice(-14),
      last7: all.slice(-7),
    };
  }, []);

  const { all, today, rec, str, slp, fit, last14, last7 } = m;
  const recPct = rec.score != null ? rec.score / 100 : 0;
  const seriesFor = (pick: (d: DailyHealth) => number | undefined): MetricSeriesPoint[] =>
    all.map((d) => ({ date: d.date, value: pick(d) ?? null }));

  return (
    <>
      <SectionHeader title="Today" />

      {/* ── Hero: recovery + strain + sleep, each tappable ───────────────── */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <button
            onClick={() => {
              tick();
              setDetail({ kind: "recovery" });
            }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
            aria-label="Recovery details"
          >
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
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-faint)" }}>
                    %
                  </span>
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
          </button>
          <div style={{ flex: 1, display: "grid", gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{rec.label}</div>
            <HeroStat
              label="Effort today"
              value={str.strain.toFixed(1)}
              suffix="/ 21"
              sub={str.label}
              color="var(--m-strain)"
              pct={str.strain / 21}
              onClick={() => setDetail({ kind: "strain" })}
            />
            <HeroStat
              label="Sleep"
              value={slp.actualHrs ? fmtHrs(slp.actualHrs) : "—"}
              sub={`${Math.round((slp.performance ?? 0) * 100)}% of ${fmtHrs(slp.needHrs)} need`}
              color="var(--m-sleep)"
              pct={slp.performance ?? 0}
              onClick={() => setDetail({ kind: "sleep" })}
            />
          </div>
        </div>
      </Card>

      {/* ── Fitness age ─────────────────────────────────────────────────── */}
      <SectionHeader title="Fitness age" />
      <Card chevron onClick={() => setDetail({ kind: "fitness" })} ariaLabel="Fitness age details">
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
            </div>
          </div>
          <div style={{ width: 110, flexShrink: 0 }}>
            <Sparkline
              values={last14.map((d) => d.vo2max ?? null)}
              color="var(--m-fitness)"
              width={110}
              height={44}
            />
            <div
              style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 4, textAlign: "right" }}
            >
              VO₂max · 14d
            </div>
          </div>
        </div>
      </Card>

      {/* ── Vitals ──────────────────────────────────────────────────────── */}
      <SectionHeader title="Vitals" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {VITALS.map((v) => (
          <VitalTile
            key={v.id}
            label={v.label}
            value={v.pick(today)}
            unit={v.unit}
            color={v.color}
            decimals={v.decimals}
            series={last14.map((d) => v.pick(d) ?? null)}
            goodDirection={v.goodDirection}
            onClick={() => setDetail({ kind: "vital", id: v.id })}
          />
        ))}
      </div>

      {/* ── Effort ──────────────────────────────────────────────────────── */}
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
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
            {str.source === "hr" ? "from HR series" : "estimated"}
          </span>
        </div>
        {str.zoneMins && str.zoneMins.some((z) => z > 0) ? (
          <>
            <ZoneBar mins={str.zoneMins} />
            <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 8 }}>
              Tap a band for the exact minutes
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-faint)" }}>
            No hard effort recorded today — that&rsquo;s a rest day.
          </div>
        )}
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            <span style={{ color: "var(--text-dim)" }}>Steps · last 7 days</span>
            <span style={{ fontWeight: 700 }}>{(today.steps ?? 0).toLocaleString()} today</span>
          </div>
          <BarStrip
            values={last7.map((d) => d.steps ?? null)}
            labels={last7.map((d) => DOW[new Date(d.date + "T12:00:00").getDay()])}
            color="var(--m-strain)"
            format={(v) => v.toLocaleString() + " steps"}
          />
        </div>
      </Card>

      {/* ── Sleep ───────────────────────────────────────────────────────── */}
      <SectionHeader title="Sleep" />
      <Card chevron onClick={() => setDetail({ kind: "sleep" })} ariaLabel="Sleep details">
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
      </Card>
      <div style={{ marginTop: 12 }}>
        <Card>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            Hours slept · 14 nights
          </div>
          <BarStrip
            values={last14.map((d) => d.sleepHrs ?? null)}
            color="var(--m-sleep)"
            height={52}
            max={10}
            format={(v) => fmtHrs(v)}
          />
        </Card>
      </div>

      {/* ── Detail sheets ───────────────────────────────────────────────── */}
      {detail?.kind === "recovery" && (
        <Sheet
          title="Recovery"
          sub="Measured against your own baseline"
          onClose={() => setDetail(null)}
        >
          <div style={{ display: "grid", gap: 16 }}>
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
                      : `${Math.round(c.score * 100)}% · counts for ${Math.round((c.weight / rec.coverage) * 100)}%`}
                  </span>
                </div>
                <ProgressBar value={c.score ?? 0} color="var(--m-recovery)" />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.65, marginTop: 18 }}>
            HRV and resting heart rate are compared against your own 30-day rolling baseline — the
            standard HRV-guided readiness approach (Plews, Buchheit) — then blended with sleep
            performance and respiratory rate. Anything without data is dropped and the rest
            re-weighted, so the score is always built from real readings. An estimate, not medical
            advice.
          </p>
        </Sheet>
      )}

      {detail?.kind === "strain" && (
        <MetricDetail
          title="Effort"
          unit=""
          decimals={1}
          color="var(--m-strain)"
          onClose={() => setDetail(null)}
          series={all.map((d) => ({
            date: d.date,
            value: strainMetric(d, DEMO_PROFILE).strain,
          }))}
          extra={
            str.zoneMins && str.zoneMins.some((z) => z > 0) ? (
              <>
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>
                  Today&rsquo;s zones — tap a band
                </div>
                <ZoneBar mins={str.zoneMins} />
              </>
            ) : undefined
          }
          explanation={`Effort is Banister's TRIMP — every minute is weighted by how hard your heart was working as a share of its usable range, then curved onto 0–21 so a hard session lands around 14. Today's raw TRIMP was ${str.trimp}. Time below roughly a fifth of your heart-rate reserve is daily living, not training, so it doesn't count.`}
        />
      )}

      {detail?.kind === "sleep" && (
        <MetricDetail
          title="Sleep"
          unit="h"
          decimals={1}
          color="var(--m-sleep)"
          goodDirection="up"
          onClose={() => setDetail(null)}
          series={seriesFor((d) => d.sleepHrs)}
          extra={
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <MiniStat label="Need tonight" value={fmtHrs(slp.needHrs)} />
              <MiniStat
                label="Debt"
                value={`${slp.debtHrs}h`}
                tone={slp.debtHrs > 3 ? "warn" : undefined}
              />
              <MiniStat
                label="Bedtime spread"
                value={slp.bedtimeSdMins != null ? `±${slp.bedtimeSdMins}m` : "—"}
              />
            </div>
          }
          explanation={`Your baseline need is ${fmtHrs(DEMO_PROFILE.sleepNeedHrs ?? 8)}, topped up by a slice of outstanding debt (capped at one extra hour so the target stays reachable) and by up to 45 minutes after a hard day. Debt is a decayed rolling shortfall over the last 14 nights. Consistency measures how tightly your bedtimes cluster — regularity matters about as much as duration.`}
        />
      )}

      {detail?.kind === "fitness" && (
        <MetricDetail
          title="Fitness age"
          unit=" yrs"
          decimals={0}
          color="var(--m-fitness)"
          goodDirection="down"
          onClose={() => setDetail(null)}
          series={all.map((d) => ({
            date: d.date,
            value: fitnessAge(
              d,
              all.filter((x) => x.date < d.date),
              DEMO_PROFILE,
            ).fitnessAge,
          }))}
          extra={
            <div style={{ display: "grid", gap: 10 }}>
              <MiniRow label="VO₂max" value={`${fit.vo2max ?? "—"} ml/kg/min`} />
              <MiniRow
                label="Source"
                value={fit.vo2Source === "device" ? "Your watch" : "Estimated from your data"}
              />
              <MiniRow label="Your actual age" value={`${DEMO_PROFILE.age}`} />
            </div>
          }
          explanation={`Your VO₂max is compared against published population medians for your age and sex. Your fitness age is the age at which your VO₂max would be typical (Nes et al., the HUNT fitness-age study). The median VO₂max for a ${DEMO_PROFILE.sex === "female" ? "woman" : "man"} of ${DEMO_PROFILE.age} is about ${DEMO_PROFILE.sex === "female" ? (47.1 - 0.294 * (DEMO_PROFILE.age ?? 22)).toFixed(1) : (57.8 - 0.372 * (DEMO_PROFILE.age ?? 22)).toFixed(1)} — the gap between that and yours is what moves this number. Cardio training is the fastest way to move it.`}
        />
      )}

      {detail?.kind === "vital" &&
        (() => {
          const v = VITALS.find((x) => x.id === detail.id)!;
          return (
            <MetricDetail
              title={v.label}
              unit={v.unit}
              decimals={v.decimals}
              color={v.color}
              goodDirection={v.goodDirection}
              series={seriesFor(v.pick)}
              explanation={v.explanation}
              onClose={() => setDetail(null)}
            />
          );
        })()}
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
  onClick,
}: {
  label: string;
  value: string;
  suffix?: string;
  sub: string;
  color: string;
  pct: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => {
        tick();
        onClick();
      }}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
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
    </button>
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
  onClick,
}: {
  label: string;
  value?: number;
  unit: string;
  color: string;
  series: (number | null)[];
  decimals?: number;
  goodDirection?: "up" | "down";
  onClick: () => void;
}) {
  const clean = series.filter((v): v is number => typeof v === "number");
  const prior = clean.slice(0, -1);
  const avg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
  const diff = value != null && avg != null ? value - avg : null;
  const good = diff == null || !goodDirection ? null : goodDirection === "up" ? diff > 0 : diff < 0;

  return (
    <Card onClick={onClick} ariaLabel={`${label} details`}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginTop: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {value != null ? value.toFixed(decimals) : "—"}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{unit.trim()}</span>
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
          {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(decimals || 1)} vs avg
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

export { shortDate };
