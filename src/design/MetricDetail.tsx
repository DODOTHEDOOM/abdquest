import { useMemo, useState } from "react";
import { Sheet, Tabs } from "./primitives";
import { Sparkline } from "./charts";

export interface MetricSeriesPoint {
  date: string; // YYYY-MM-DD
  value: number | null;
}

/**
 * The "tap anything, get the exact numbers" sheet.
 *
 * Shows the current value, a scrubbable history you can drag along to read any
 * single day, min/avg/max over the selected range, and a plain-English
 * explanation of what the number actually means.
 */
export function MetricDetail({
  title,
  unit = "",
  decimals = 0,
  color,
  series,
  explanation,
  goodDirection,
  extra,
  onClose,
}: {
  title: string;
  unit?: string;
  decimals?: number;
  color: string;
  series: MetricSeriesPoint[];
  explanation: string;
  goodDirection?: "up" | "down";
  extra?: React.ReactNode;
  onClose: () => void;
}) {
  const [range, setRange] = useState<"7" | "14" | "30">("14");

  const view = useMemo(() => {
    const n = parseInt(range, 10);
    const slice = series.slice(-n);
    const nums = slice.map((p) => p.value).filter((v): v is number => typeof v === "number");
    const latest = [...slice].reverse().find((p) => typeof p.value === "number")?.value ?? null;
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    const first = nums.length ? nums[0] : null;
    const trend = latest != null && first != null ? latest - first : null;
    return {
      slice,
      latest,
      avg,
      min: nums.length ? Math.min(...nums) : null,
      max: nums.length ? Math.max(...nums) : null,
      trend,
      count: nums.length,
    };
  }, [series, range]);

  const fmt = (v: number | null) => (v == null ? "—" : v.toFixed(decimals) + unit);
  const trendGood =
    view.trend == null || !goodDirection
      ? null
      : goodDirection === "up"
        ? view.trend > 0
        : view.trend < 0;

  return (
    <Sheet title={title} onClose={onClose}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          justifyContent: "center",
          marginTop: -8,
        }}
      >
        <span
          style={{
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1,
            color,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {view.latest != null ? view.latest.toFixed(decimals) : "—"}
        </span>
        <span style={{ fontSize: 15, color: "var(--text-dim)" }}>{unit}</span>
      </div>

      {view.trend != null && (
        <div
          style={{
            textAlign: "center",
            marginTop: 8,
            fontSize: 12.5,
            fontWeight: 600,
            color:
              trendGood == null ? "var(--text-dim)" : trendGood ? "var(--m-habits)" : "var(--warn)",
          }}
        >
          {view.trend > 0 ? "▲" : view.trend < 0 ? "▼" : "•"}{" "}
          {Math.abs(view.trend).toFixed(decimals || 1)}
          {unit} over {range} days
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", margin: "18px 0 14px" }}>
        <Tabs
          tabs={[
            { id: "7", label: "7 days" },
            { id: "14", label: "14 days" },
            { id: "30", label: "30 days" },
          ]}
          value={range}
          onChange={(id) => setRange(id as typeof range)}
        />
      </div>

      <div
        style={{
          background: "var(--surface-2)",
          borderRadius: "var(--radius-sm)",
          padding: "22px 12px 10px",
        }}
      >
        <Sparkline
          values={view.slice.map((p) => p.value)}
          labels={view.slice.map((p) => shortDate(p.date))}
          color={color}
          width={280}
          height={72}
          unit={unit}
          decimals={decimals}
          interactive
        />
        <div
          style={{ fontSize: 10.5, color: "var(--text-faint)", textAlign: "center", marginTop: 8 }}
        >
          Drag across the chart to read any day
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
        <Box label="Low" value={fmt(view.min)} />
        <Box label="Average" value={fmt(view.avg)} />
        <Box label="High" value={fmt(view.max)} />
      </div>

      {extra && <div style={{ marginTop: 16 }}>{extra}</div>}

      <p style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.65, marginTop: 18 }}>
        {explanation}
      </p>
      <p style={{ fontSize: 11, color: "var(--text-faint)", lineHeight: 1.6, marginTop: 10 }}>
        Based on {view.count} day{view.count === 1 ? "" : "s"} with data in this range. An estimate
        from your own readings — not medical advice.
      </p>
    </Sheet>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 8px",
        textAlign: "center",
      }}
    >
      <div
        style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 700, letterSpacing: "0.04em" }}
      >
        {label.toUpperCase()}
      </div>
      <div
        style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums", marginTop: 2 }}
      >
        {value}
      </div>
    </div>
  );
}

export function shortDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
