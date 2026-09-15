import { THEMES, type Theme } from "./themes";
import { tick } from "./charts";

/**
 * Colourway grid. Each card is a live miniature of the theme: its background,
 * its colour fields and a tiny version of the ring stack in its own metric hues.
 */
export function ThemePicker({
  value,
  level,
  onChange,
}: {
  value: string;
  level: number;
  onChange: (theme: Theme, locked: boolean) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {THEMES.map((t) => {
        const locked = level < t.unlockLevel;
        const active = t.id === value;
        const v = t.vars;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              tick(10);
              onChange(t, locked);
            }}
            aria-pressed={active}
            style={{
              textAlign: "left",
              padding: 6,
              borderRadius: 18,
              cursor: "pointer",
              background: "var(--surface-raised)",
              border: active ? "2px solid var(--text)" : "1px solid var(--border)",
              boxShadow: active ? "var(--elev-3)" : "var(--elev-1)",
              transform: active ? "translateY(-2px)" : "none",
              transition: "transform .18s, box-shadow .18s",
            }}
          >
            <div
              style={{
                position: "relative",
                height: 96,
                borderRadius: 13,
                overflow: "hidden",
                background: v["--bg"],
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `radial-gradient(circle at 12% 10%, ${v["--blob-1"]} 0%, transparent 55%),
                    radial-gradient(circle at 95% 45%, ${v["--blob-2"]} 0%, transparent 55%),
                    radial-gradient(circle at 30% 110%, ${v["--blob-3"]} 0%, transparent 55%)`,
                  opacity: 0.95,
                }}
              />
              <MiniRings
                colors={[
                  [v["--m-recovery"], v["--m-recovery-2"]],
                  [v["--m-strain"], v["--m-strain-2"]],
                  [v["--m-sleep"], v["--m-sleep-2"]],
                ]}
                track={v["--groove"]}
              />
              {locked && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(0,0,0,0.28)",
                    backdropFilter: "blur(2px)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.02em",
                  }}
                >
                  🔒 Level {t.unlockLevel}
                </div>
              )}
            </div>
            <div style={{ padding: "8px 4px 2px" }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                {t.name}
                {active && <span style={{ fontSize: 11, color: "var(--text-dim)" }}>On</span>}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--text-faint)",
                  marginTop: 2,
                  lineHeight: 1.35,
                }}
              >
                {t.blurb}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MiniRings({ colors, track }: { colors: [string, string][]; track: string }) {
  const values = [0.82, 0.62, 0.74];
  const size = 64;
  const stroke = 7;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: "absolute", right: 12, bottom: 12, transform: "rotate(-90deg)" }}
      aria-hidden="true"
    >
      {colors.map(([c1, c2], i) => {
        const r = size / 2 - stroke / 2 - i * (stroke + 2);
        const circ = 2 * Math.PI * r;
        const id = `mr-${c1.replace(/[^a-z0-9]/gi, "")}-${i}`;
        return (
          <g key={i}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={c1} />
                <stop offset="100%" stopColor={c2} />
              </linearGradient>
            </defs>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={track}
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={`url(#${id})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - values[i])}
            />
          </g>
        );
      })}
    </svg>
  );
}
