import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import "./ring3d.css";

/**
 * A dimensional progress ring. See ring3d.css for how the layers build the
 * depth. It animates from empty to `value` on mount (and between values after).
 */
export function Ring3D({
  value,
  size = 120,
  thickness = 12,
  color,
  color2,
  face = true,
  delay = 0,
  label,
  children,
}: {
  value: number; // 0..1
  size?: number;
  thickness?: number;
  color: string;
  color2?: string;
  face?: boolean;
  delay?: number;
  label?: string;
  children?: ReactNode;
}) {
  const [p, setP] = useState(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(1, value || 0));
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setP(target);
      return;
    }
    const id = window.setTimeout(() => setP(target), 40 + delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  const style = {
    "--size": `${size}px`,
    "--t": `${thickness}px`,
    "--p": p,
    "--c1": color,
    "--c2": color2 ?? color,
  } as CSSProperties;
  const capOpacity = p > 0.004 ? 1 : 0;

  return (
    <div className="r3" style={style} role={label ? "img" : undefined} aria-label={label}>
      <div className="r3__groove" />
      <div className="r3__glow">
        <div className="r3__glowInner" />
      </div>
      <div className="r3__arc" />
      <div className="r3__cap r3__cap--start" style={{ opacity: capOpacity }}>
        <span />
      </div>
      <div className="r3__cap r3__cap--end" style={{ opacity: capOpacity }}>
        <span />
      </div>
      {face && <div className="r3__face">{children}</div>}
    </div>
  );
}

export interface StackRing {
  value: number;
  color: string;
  color2?: string;
  label: string;
}

/** Concentric rings, outermost first — the "all your day at a glance" hero. */
export function RingStack({
  rings,
  size = 184,
  thickness = 14,
  gap = 5,
  children,
}: {
  rings: StackRing[];
  size?: number;
  thickness?: number;
  gap?: number;
  children?: ReactNode;
}) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {rings.map((r, i) => {
        const offset = i * (thickness + gap);
        const inner = i === rings.length - 1;
        return (
          <div key={r.label} style={{ position: "absolute", left: offset, top: offset }}>
            <Ring3D
              value={r.value}
              color={r.color}
              color2={r.color2}
              size={size - 2 * offset}
              thickness={thickness}
              face={inner}
              delay={i * 160}
              label={`${r.label} ${Math.round(r.value * 100)}%`}
            >
              {inner ? children : null}
            </Ring3D>
          </div>
        );
      })}
    </div>
  );
}
