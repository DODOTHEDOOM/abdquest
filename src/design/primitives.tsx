import type { CSSProperties, ReactNode } from "react";
import { tick } from "./charts";
import "./primitives.css";

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({
  children,
  flush,
  style,
  className = "",
  onClick,
  chevron,
  ariaLabel,
}: {
  children: ReactNode;
  flush?: boolean;
  style?: CSSProperties;
  className?: string;
  /** Providing onClick makes the whole card a pressable surface. */
  onClick?: () => void;
  /** Show a "there's more behind this" chevron. */
  chevron?: boolean;
  ariaLabel?: string;
}) {
  const cls =
    `card${flush ? " card--flush" : ""}${onClick ? " card--interactive" : ""} ${className}`.trim();
  if (!onClick) {
    return (
      <div className={cls} style={style}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      style={style}
      aria-label={ariaLabel}
      onClick={() => {
        tick();
        onClick();
      }}
    >
      {chevron ? (
        <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
          <svg
            className="card__chevron"
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

// ── Button ──────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "ghost" | "danger";
export function Button({
  children,
  variant = "ghost",
  block,
  sm,
  disabled,
  onClick,
  type = "button",
  style,
}: {
  children: ReactNode;
  variant?: BtnVariant;
  block?: boolean;
  sm?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={`btn btn--${variant}${block ? " btn--block" : ""}${sm ? " btn--sm" : ""}`}
    >
      {children}
    </button>
  );
}

// ── Field ───────────────────────────────────────────────────────────────────
export function Field({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      {label && <span className="field__label">{label}</span>}
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field__control ${props.className || ""}`.trim()} />;
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`field__control ${props.className || ""}`.trim()} />;
}

// ── Stat ────────────────────────────────────────────────────────────────────
export function Stat({
  label,
  value,
  sub,
  align = "left",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  align?: "left" | "center" | "right";
}) {
  return (
    <div style={{ textAlign: align }}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {sub != null && <div className="stat__sub">{sub}</div>}
    </div>
  );
}

// ── ProgressBar ─────────────────────────────────────────────────────────────
export function ProgressBar({
  value,
  color,
  ariaLabel,
}: {
  value: number; // 0..1
  color?: string;
  ariaLabel?: string;
}) {
  const pct = Math.max(0, Math.min(1, value || 0)) * 100;
  return (
    <div
      className="bar"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div className="bar__fill" style={{ width: pct + "%", background: color }} />
    </div>
  );
}

// ── Ring (SVG circular progress) ────────────────────────────────────────────
export function Ring({
  value,
  size = 112,
  stroke = 10,
  color = "var(--accent)",
  track = "var(--surface-2)",
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value || 0));
  const gid = `ring-${size}-${String(color).replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          {/* A gradient along the arc reads as light falling across a solid
              object, which is what gives the ring its dimensionality. */}
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.65" />
            <stop offset="55%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{
            transition: "stroke-dashoffset 0.7s cubic-bezier(0.2,0.8,0.3,1)",
            filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.16))",
          }}
        />
      </svg>
      {children != null && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── SectionHeader ───────────────────────────────────────────────────────────
export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="sectionhead">
      <span className="sectionhead__title">{title}</span>
      {action && (
        <button className="sectionhead__action" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

// ── Tabs (segmented control) ────────────────────────────────────────────────
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          className="tabs__tab"
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warn";
}) {
  return (
    <span
      className={`badge${tone === "accent" ? " badge--accent" : tone === "warn" ? " badge--warn" : ""}`}
    >
      {children}
    </span>
  );
}

// ── Sheet (bottom sheet) ────────────────────────────────────────────────────
export function Sheet({
  title,
  sub,
  onClose,
  children,
}: {
  title?: string;
  sub?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__grab" />
        {title && <h2 className="sheet__title">{title}</h2>}
        {sub && <p className="sheet__sub">{sub}</p>}
        {children}
      </div>
    </>
  );
}

// ── NavBar ──────────────────────────────────────────────────────────────────
export function NavBar<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string; icon: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav className="navbar">
      <div className="navbar__inner">
        {items.map((it) => (
          <button
            key={it.id}
            className="navbar__item"
            aria-current={value === it.id ? "page" : undefined}
            onClick={() => {
              tick();
              onChange(it.id);
            }}
          >
            <span className="navbar__icon">{it.icon}</span>
            <span className="navbar__label">{it.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ── Toast ───────────────────────────────────────────────────────────────────
export function Toast({ children }: { children: ReactNode }) {
  return (
    <div className="toast" role="status">
      {children}
    </div>
  );
}
