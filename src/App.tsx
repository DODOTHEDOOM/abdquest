import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  NavBar,
  ProgressBar,
  Ring,
  SectionHeader,
  Sheet,
  Stat,
  Tabs,
  TextArea,
  TextInput,
  Toast,
} from "./design/primitives";

/**
 * Stage 3 — design-language preview.
 *
 * This is NOT the app yet. It's a gallery of the new primitives so the visual
 * direction can be reviewed before the real screens are built (Onboarding, Today,
 * Progress, Track, Habits, Prayers, Workouts, Journal, Settings). The old app is
 * still `legacy/AbdQuest.html` and still deployed.
 */
export function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return (localStorage.getItem("aq_demo_theme") as "light" | "dark") || "light";
    } catch {
      return "light";
    }
  });
  const [tab, setTab] = useState<"today" | "week">("today");
  const [nav, setNav] = useState<"today" | "habits" | "progress" | "you">("today");
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("aq_demo_theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 96 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Abd&rsquo;s Quest
            </div>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>design preview</div>
          </div>
          <Button sm variant="ghost" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "Dark" : "Light"}
          </Button>
        </header>

        <SectionHeader title="Daily summary" action="Details" onAction={() => setSheet(true)} />
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Ring value={0.72} size={104}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>72</div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "var(--text-dim)",
                  }}
                >
                  READY
                </div>
              </div>
            </Ring>
            <div style={{ flex: 1, display: "grid", gap: 12 }}>
              <Stat label="Streak" value="12 days" sub="best 15" />
              <Stat label="Level" value="7" sub="240 pts to 8" />
            </div>
          </div>
        </Card>

        <SectionHeader title="Today's habits" />
        <Card flush>
          {[
            ["Move for 20 min", true],
            ["No junk food", true],
            ["Sleep before 1am", false],
            ["Drink 3L water", false],
          ].map(([name, done], i) => (
            <button
              key={i}
              onClick={() => setToast(done ? "Marked not done" : "Nice — habit done")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                textAlign: "left",
                padding: "14px 16px",
                background: "none",
                border: "none",
                borderTop: i ? "1px solid var(--border)" : "none",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 7,
                  border: "2px solid",
                  borderColor: done ? "var(--accent)" : "var(--border-strong)",
                  background: done ? "var(--accent)" : "transparent",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {done ? "✓" : ""}
              </span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: done ? "var(--text-dim)" : "var(--text)",
                  textDecoration: done ? "line-through" : "none",
                }}
              >
                {name}
              </span>
            </button>
          ))}
        </Card>

        <SectionHeader title="This week" />
        <div style={{ marginBottom: 12 }}>
          <Tabs
            tabs={[
              { id: "today", label: "Today" },
              { id: "week", label: "Week" },
            ]}
            value={tab}
            onChange={(id) => setTab(id as typeof tab)}
          />
        </div>
        <Card>
          <div style={{ display: "grid", gap: 14 }}>
            {[
              ["Habits", 0.86],
              ["Sleep target", 0.57],
              ["Workouts", 0.75],
              ["Water", 0.4],
            ].map(([label, v]) => (
              <div key={label as string}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: "var(--text-dim)" }}>{label}</span>
                  <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {Math.round((v as number) * 100)}%
                  </span>
                </div>
                <ProgressBar value={v as number} ariaLabel={label as string} />
              </div>
            ))}
          </div>
        </Card>

        <SectionHeader title="Components" />
        <Card>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <Badge>neutral</Badge>
            <Badge tone="accent">on track</Badge>
            <Badge tone="warn">behind</Badge>
          </div>
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            <Button variant="primary" block onClick={() => setToast("Primary tapped")}>
              Primary action
            </Button>
            <Button variant="ghost" block onClick={() => setToast("Ghost tapped")}>
              Secondary
            </Button>
            <Button variant="danger" block onClick={() => setToast("Danger tapped")}>
              Destructive
            </Button>
          </div>
          <Field label="Display name" hint="Shown on your profile">
            <TextInput placeholder="e.g. Sam" />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="Journal">
            <TextArea placeholder="How did today go?" />
          </Field>
        </Card>
      </div>

      {sheet && (
        <Sheet
          title="Daily summary"
          sub="How today's number is built"
          onClose={() => setSheet(false)}
        >
          <div style={{ display: "grid", gap: 12 }}>
            {[
              ["Sleep", "7h 10m", 0.9],
              ["Resting HR", "54 bpm", 0.7],
              ["Yesterday's activity", "8,900 steps", 0.6],
            ].map(([k, v, p]) => (
              <div key={k as string}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14,
                    marginBottom: 6,
                  }}
                >
                  <span>{k}</span>
                  <span style={{ color: "var(--text-dim)" }}>{v}</span>
                </div>
                <ProgressBar value={p as number} />
              </div>
            ))}
          </div>
          <div style={{ height: 16 }} />
          <Button variant="ghost" block onClick={() => setSheet(false)}>
            Close
          </Button>
        </Sheet>
      )}

      {toast && <Toast>{toast}</Toast>}

      <NavBar
        items={[
          {
            id: "today",
            label: "Today",
            icon: <NavIcon d="M3 10.8 12 3.2l9 7.6M5.6 9.6V20.5h12.8V9.6" />,
          },
          { id: "habits", label: "Habits", icon: <NavIcon d="M4 6.5h16M4 12h16M4 17.5h16" /> },
          {
            id: "progress",
            label: "Progress",
            icon: <NavIcon d="M5 20.5v-6.5M11 20.5V7.5M17 20.5V11M3.2 20.5h17.6" />,
          },
          {
            id: "you",
            label: "You",
            icon: <NavIcon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
          },
        ]}
        value={nav}
        onChange={(id) => setNav(id as typeof nav)}
      />
    </div>
  );
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
