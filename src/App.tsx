import { useEffect, useState } from "react";
import { Badge, Button, Card, NavBar, SectionHeader, Toast } from "./design/primitives";
import { BarStrip } from "./design/charts";
import { Dashboard } from "./screens/Dashboard";

/**
 * Stage 3 — design + metrics preview.
 *
 * The deployed app is still `legacy/AbdQuest.html`. This shell shows the new
 * visual language and the new metrics engine (`src/lib/metrics`) running on
 * sample data, so the direction can be reviewed before the remaining screens
 * are rebuilt.
 */
export function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return (localStorage.getItem("aq_demo_theme") as "light" | "dark") || "light";
    } catch {
      return "light";
    }
  });
  const [nav, setNav] = useState<"today" | "habits" | "progress" | "you">("today");
  const [toast, setToast] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({ move: true, junk: true });

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
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const habits = [
    { id: "move", name: "Move for 20 minutes" },
    { id: "junk", name: "No junk food" },
    { id: "sleep", name: "In bed before 1am" },
    { id: "water", name: "Drink 3L of water" },
    { id: "read", name: "Read 20 minutes" },
  ];
  const doneCount = habits.filter((h) => done[h.id]).length;

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 92 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px" }}>
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 2 }}>
              Good evening
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <Badge tone="accent">🔥 12-day streak</Badge>
              <Badge>Level 7</Badge>
            </div>
          </div>
          <Button sm variant="ghost" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "Dark" : "Light"}
          </Button>
        </header>

        <Dashboard />

        <SectionHeader title="Discipline" />
        <Card flush>
          <div
            style={{
              padding: "14px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>Today&rsquo;s habits</span>
            <span
              style={{ fontSize: 13, color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}
            >
              {doneCount} / {habits.length}
            </span>
          </div>
          {habits.map((hbt, i) => {
            const isDone = !!done[hbt.id];
            return (
              <button
                key={hbt.id}
                onClick={() => {
                  setDone((d) => ({ ...d, [hbt.id]: !d[hbt.id] }));
                  setToast(isDone ? "Unmarked" : "Done — nice");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  textAlign: "left",
                  padding: "13px 16px",
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
                    borderColor: isDone ? "var(--m-habits)" : "var(--border-strong)",
                    background: isDone ? "var(--m-habits)" : "transparent",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  {isDone ? "✓" : ""}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: isDone ? "var(--text-dim)" : "var(--text)",
                    textDecoration: isDone ? "line-through" : "none",
                  }}
                >
                  {hbt.name}
                </span>
              </button>
            );
          })}
        </Card>

        <div style={{ marginTop: 12 }}>
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                marginBottom: 8,
              }}
            >
              <span style={{ color: "var(--text-dim)" }}>Habits completed · last 14 days</span>
              <span style={{ fontWeight: 600 }}>86% consistent</span>
            </div>
            <BarStrip
              values={[5, 4, 5, 3, 5, 5, 2, 4, 5, 5, 5, 3, 4, doneCount]}
              color="var(--m-habits)"
              height={44}
              max={5}
            />
          </Card>
        </div>
      </div>

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
