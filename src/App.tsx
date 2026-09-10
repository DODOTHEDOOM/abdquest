import { useEffect, useState } from "react";
import { Badge, Button, NavBar } from "./design/primitives";
import { Dashboard } from "./screens/Dashboard";
import { Habits } from "./screens/Habits";
import { Progress } from "./screens/Progress";
import { You } from "./screens/You";

type Tab = "today" | "habits" | "progress" | "you";

const TITLES: Record<Tab, string> = {
  today: "Good evening",
  habits: "Habits",
  progress: "Progress",
  you: "You",
};

/**
 * Stage 3 preview shell.
 *
 * The deployed app is still `legacy/AbdQuest.html`. This runs the new design
 * system and metrics engine on sample data so the direction can be reviewed.
 */
export function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return (localStorage.getItem("aq_demo_theme") as "light" | "dark") || "light";
    } catch {
      return "light";
    }
  });
  const [tab, setTab] = useState<Tab>("today");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("aq_demo_theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Jump back to the top when switching tabs, so each screen starts at its head.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 120 }}>
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
              {TITLES[tab]}
            </div>
            {tab === "today" && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <Badge tone="accent">🔥 12-day streak</Badge>
                <Badge>Level 7</Badge>
              </div>
            )}
          </div>
          <Button sm variant="ghost" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "Dark" : "Light"}
          </Button>
        </header>

        <div key={tab} style={{ animation: "tabIn .28s cubic-bezier(.22,.8,.3,1)" }}>
          {tab === "today" && <Dashboard />}
          {tab === "habits" && <Habits />}
          {tab === "progress" && <Progress />}
          {tab === "you" && <You theme={theme} onTheme={setTheme} />}
        </div>
      </div>

      <NavBar
        items={[
          {
            id: "today",
            label: "Today",
            icon: <NavIcon d="M3 10.8 12 3.2l9 7.6M5.6 9.6V20.5h12.8V9.6" />,
          },
          {
            id: "habits",
            label: "Habits",
            icon: <NavIcon d="m4 7 2 2 3.5-3.5M4 16l2 2 3.5-3.5M13 7.5h7M13 16.5h7" />,
          },
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
        value={tab}
        onChange={(id) => setTab(id as Tab)}
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
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
