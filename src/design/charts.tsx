/** Small, honest charts. No library — plain SVG, token-coloured, theme-aware. */

export function Sparkline({
  values,
  color = "var(--text-dim)",
  width = 96,
  height = 28,
  fill = true,
}: {
  values: (number | null)[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  const pts = values.filter((v): v is number => typeof v === "number" && isFinite(v));
  if (pts.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4);

  let d = "";
  let started = false;
  values.forEach((v, i) => {
    if (typeof v !== "number" || !isFinite(v)) return;
    const cmd = started ? "L" : "M";
    d += `${cmd}${(i * step).toFixed(1)},${y(v).toFixed(1)}`;
    started = true;
  });

  const area = fill ? `${d}L${width},${height}L0,${height}Z` : "";
  const gid = `sg-${Math.abs(hash(values.join(","))).toString(36)}`;

  // viewBox + width:100% so a sparkline scales to whatever card it sits in
  // instead of overflowing on narrow screens.
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      height={height}
      aria-hidden="true"
      style={{ display: "block", width: "100%", height }}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
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
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

/** A row of day bars — the "last 7/14 days at a glance" strip. */
export function BarStrip({
  values,
  labels,
  color = "var(--m-habits)",
  height = 56,
  max,
}: {
  values: (number | null)[];
  labels?: string[];
  color?: string;
  height?: number;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...values.map((v) => v || 0));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }}>
      {values.map((v, i) => {
        const pct = v == null ? 0 : Math.max(0.04, Math.min(1, v / top));
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                height: height - (labels ? 16 : 0),
                display: "flex",
                alignItems: "flex-end",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: `${pct * 100}%`,
                  background: v == null ? "var(--surface-2)" : color,
                  opacity: v == null ? 1 : 0.25 + pct * 0.75,
                  borderRadius: 4,
                  transition: "height 0.5s cubic-bezier(0.2,0.8,0.3,1)",
                }}
              />
            </div>
            {labels && (
              <div
                style={{
                  fontSize: 9,
                  textAlign: "center",
                  color: "var(--text-faint)",
                  fontWeight: 600,
                }}
              >
                {labels[i]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Heart-rate zone distribution, zone 1..5 left to right. */
export function ZoneBar({ mins }: { mins: number[] }) {
  const total = mins.reduce((a, b) => a + b, 0) || 1;
  const colors = [
    "var(--m-sleep)",
    "var(--m-recovery)",
    "var(--m-habits)",
    "var(--m-strain)",
    "var(--danger)",
  ];
  return (
    <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", gap: 2 }}>
      {mins.map((m, i) => (
        <div
          key={i}
          title={`Zone ${i + 1}: ${Math.round(m)} min`}
          style={{
            width: `${(m / total) * 100}%`,
            background: colors[i],
            opacity: m ? 1 : 0.15,
          }}
        />
      ))}
    </div>
  );
}
