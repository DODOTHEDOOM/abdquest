/**
 * Small, honest charts — plain SVG, token-coloured, theme-aware.
 *
 * All of them are interactive: tap (or drag along) any chart to pin a point and
 * read the exact value for that day.
 */

import { useCallback, useRef, useState } from "react";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

/** Light haptic tick on devices that support it. */
export function tick(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported — no problem */
  }
}

export interface ChartPoint {
  value: number | null;
  label: string;
}

// ── Sparkline ───────────────────────────────────────────────────────────────
export function Sparkline({
  values,
  labels,
  color = "var(--text-dim)",
  width = 96,
  height = 28,
  fill = true,
  unit = "",
  decimals = 0,
  interactive = false,
}: {
  values: (number | null)[];
  labels?: string[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  unit?: string;
  decimals?: number;
  interactive?: boolean;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const lastIdx = useRef<number | null>(null);

  const pts = values.filter((v): v is number => typeof v === "number" && isFinite(v));

  const pick = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const frac = (clientX - r.left) / r.width;
      const i = Math.max(0, Math.min(values.length - 1, Math.round(frac * (values.length - 1))));
      if (i !== lastIdx.current) {
        lastIdx.current = i;
        tick();
      }
      setSel(i);
    },
    [values.length],
  );

  if (pts.length < 2) {
    return <div style={{ height }} aria-hidden="true" />;
  }

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);

  let d = "";
  let started = false;
  values.forEach((v, i) => {
    if (typeof v !== "number" || !isFinite(v)) return;
    d += `${started ? "L" : "M"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`;
    started = true;
  });

  const area = fill ? `${d}L${width},${height}L0,${height}Z` : "";
  const gid = `sg-${Math.abs(hash(values.join(",") + color)).toString(36)}`;
  const selVal = sel != null ? values[sel] : null;

  return (
    <div
      ref={ref}
      style={{ position: "relative", width: "100%", touchAction: interactive ? "none" : undefined }}
      onPointerDown={
        interactive
          ? (e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              pick(e.clientX);
            }
          : undefined
      }
      onPointerMove={interactive ? (e) => e.buttons !== 0 && pick(e.clientX) : undefined}
      onPointerUp={
        interactive
          ? () => {
              lastIdx.current = null;
              setSel(null);
            }
          : undefined
      }
      onPointerCancel={interactive ? () => setSel(null) : undefined}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ display: "block", width: "100%", height }}
      >
        {fill && (
          <>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.26" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid})`} />
          </>
        )}
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {sel != null && typeof selVal === "number" && (
          <>
            <line
              x1={sel * step}
              x2={sel * step}
              y1={0}
              y2={height}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="2 2"
              opacity={0.5}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={sel * step}
              cy={y(selVal)}
              r={3.2}
              fill={color}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      {sel != null && typeof selVal === "number" && (
        <div
          style={{
            position: "absolute",
            top: -6,
            left: `${(sel / (values.length - 1)) * 100}%`,
            transform: `translate(-${sel === 0 ? 0 : sel === values.length - 1 ? 100 : 50}%, -100%)`,
            background: "var(--text)",
            color: "var(--bg)",
            borderRadius: 7,
            padding: "4px 8px",
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "var(--elev-2)",
            zIndex: 5,
          }}
        >
          {selVal.toFixed(decimals)}
          {unit}
          {labels?.[sel] && <span style={{ opacity: 0.6 }}> · {labels[sel]}</span>}
        </div>
      )}
    </div>
  );
}

// ── BarStrip ────────────────────────────────────────────────────────────────
export function BarStrip({
  values,
  labels,
  color = "var(--m-habits)",
  height = 56,
  max,
  unit = "",
  decimals = 0,
  interactive = true,
  format,
}: {
  values: (number | null)[];
  labels?: string[];
  color?: string;
  height?: number;
  max?: number;
  unit?: string;
  decimals?: number;
  interactive?: boolean;
  format?: (v: number) => string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const top = max ?? Math.max(1, ...values.map((v) => v || 0));
  const barH = height - (labels ? 16 : 0);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }}>
        {values.map((v, i) => {
          const pct = v == null ? 0 : Math.max(0.05, Math.min(1, v / top));
          const isSel = sel === i;
          return (
            <button
              key={i}
              disabled={!interactive}
              onClick={() => {
                if (!interactive) return;
                tick();
                setSel(isSel ? null : i);
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                background: "none",
                border: "none",
                padding: 0,
                cursor: interactive ? "pointer" : "default",
                minHeight: 0,
              }}
            >
              <div style={{ height: barH, width: "100%", display: "flex", alignItems: "flex-end" }}>
                <div
                  style={{
                    width: "100%",
                    height: `${pct * 100}%`,
                    background: v == null ? "var(--surface-2)" : color,
                    opacity: v == null ? 1 : isSel ? 1 : sel == null ? 0.3 + pct * 0.7 : 0.25,
                    borderRadius: 5,
                    boxShadow: isSel ? "var(--elev-2)" : undefined,
                    transform: isSel ? "scaleX(1.08)" : undefined,
                    transition: "height .5s cubic-bezier(.2,.8,.3,1), opacity .18s, transform .18s",
                  }}
                />
              </div>
              {labels && (
                <span
                  style={{
                    fontSize: 9,
                    textAlign: "center",
                    color: isSel ? "var(--text)" : "var(--text-faint)",
                    fontWeight: isSel ? 800 : 600,
                  }}
                >
                  {labels[i]}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {sel != null && values[sel] != null && (
        <div
          style={{
            position: "absolute",
            top: -30,
            left: `${((sel + 0.5) / values.length) * 100}%`,
            transform: "translateX(-50%)",
            background: "var(--text)",
            color: "var(--bg)",
            borderRadius: 7,
            padding: "4px 9px",
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "var(--elev-2)",
            pointerEvents: "none",
          }}
        >
          {format
            ? format(values[sel] as number)
            : (values[sel] as number).toFixed(decimals) + unit}
        </div>
      )}
    </div>
  );
}

// ── ZoneBar ─────────────────────────────────────────────────────────────────
const ZONE_COLORS = [
  "var(--m-sleep)",
  "var(--m-recovery)",
  "var(--m-habits)",
  "var(--m-strain)",
  "var(--danger)",
];
const ZONE_NAMES = ["Very light", "Light", "Moderate", "Hard", "Maximum"];

export function ZoneBar({
  mins,
  onSelect,
}: {
  mins: number[];
  onSelect?: (i: number | null) => void;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const total = mins.reduce((a, b) => a + b, 0) || 1;
  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", gap: 2 }}>
        {mins.map((m, i) => (
          <button
            key={i}
            aria-label={`Zone ${i + 1}, ${Math.round(m)} minutes`}
            onClick={() => {
              tick();
              const next = sel === i ? null : i;
              setSel(next);
              onSelect?.(next);
            }}
            style={{
              width: `${(m / total) * 100}%`,
              minWidth: m ? 4 : 0,
              background: ZONE_COLORS[i],
              opacity: m ? (sel == null || sel === i ? 1 : 0.3) : 0.15,
              border: "none",
              padding: 0,
              cursor: "pointer",
              transition: "opacity .18s",
            }}
          />
        ))}
      </div>
      {sel != null && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-dim)" }}>
          <strong style={{ color: ZONE_COLORS[sel] }}>
            Zone {sel + 1} · {ZONE_NAMES[sel]}
          </strong>{" "}
          — {Math.round(mins[sel])} min ({Math.round((mins[sel] / total) * 100)}% of active time)
        </div>
      )}
    </div>
  );
}
