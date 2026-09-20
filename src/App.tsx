import { useEffect, useState } from "react";
import { Ambient } from "./design/Ambient";
import { tick } from "./design/charts";
import { Badge, NavBar, Sheet, Toast } from "./design/primitives";
import { ThemePicker } from "./design/ThemePicker";
import { applyTheme, themeById, type Theme } from "./design/themes";
import { ymd } from "./lib/dates";
import { Body } from "./screens/Body";
import { Dashboard } from "./screens/Dashboard";
import { Habits } from "./screens/Habits";
import { Onboarding } from "./screens/Onboarding";
import { Progress } from "./screens/Progress";
import { Training } from "./screens/Training";
import { You } from "./screens/You";
import { habitsDoneOn, levelProgress } from "./state/schema";
import { useStore } from "./state/store";

type Tab = "today" | "habits" | "training" | "body" | "progress" | "you";

const TITLES: Record<Exclude<Tab, "today">, string> = {
  habits: "Habits",
  training: "Training",
  body: "Body",
  progress: "Progress",
  you: "You",
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up?";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function App() {
  const { state, dispatch, saveFailed, source } = useStore();
  const [tab, setTab] = useState<Tab>("today");
  const [picker, setPicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const today = ymd(new Date());
  const level = levelProgress(state.xp);

  const doneToday = habitsDoneOn(state, today);

  useEffect(() => {
    applyTheme(themeById(state.themeId));
  }, [state.themeId]);

  // One-time note when their old data has just been brought across.
  useEffect(() => {
    if (source === "v2") {
      setToast("Your data moved across — nothing was changed in the old app");
    }
  }, [source]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const pickTheme = (t: Theme, locked: boolean) => {
    dispatch({ type: "setTheme", themeId: t.id });
    setToast(locked ? `Previewing ${t.name} — unlocks at Level ${t.unlockLevel}` : `${t.name} on`);
  };

  // Setup runs first for anyone arriving with no data. This sits AFTER every
  // hook above on purpose: returning early from the middle of a component
  // changes the number of hooks React sees between renders, and finishing
  // onboarding then crashes the app with "rendered more hooks than expected".
  if (!state.onboarded) return <Onboarding onDone={() => setTab("today")} />;

  return (
    <>
      <Ambient />

      {saveFailed && (
        <div className="savefail">
          Could not save — this device may be out of storage. Export a backup from the You tab.
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", paddingBottom: 124 }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 16px" }}>
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
              <div
                style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.035em", marginTop: 2 }}
              >
                {tab === "today" ? greeting() : TITLES[tab]}
              </div>
              {tab === "today" && (
                <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                  {state.streak.current > 0 && (
                    <Badge tone="accent">{state.streak.current}-day streak</Badge>
                  )}
                  <Badge>Level {level.level}</Badge>
                  {state.habits.length > 0 && (
                    <Badge>
                      {doneToday}/{state.habits.length} today
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <button
              className="iconbtn"
              aria-label="Change colourway"
              onClick={() => {
                tick();
                setPicker(true);
              }}
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2Z"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinejoin="round"
                />
                <circle cx={7.5} cy={11.5} r={1.3} fill="currentColor" />
                <circle cx={10} cy={7.3} r={1.3} fill="currentColor" />
                <circle cx={15} cy={7.8} r={1.3} fill="currentColor" />
              </svg>
            </button>
          </header>

          <div key={tab} style={{ animation: "tabIn .32s cubic-bezier(.22,.8,.3,1)" }}>
            {tab === "today" && <Dashboard />}
            {tab === "habits" && <Habits />}
            {tab === "training" && <Training />}
            {tab === "body" && <Body />}
            {tab === "progress" && <Progress />}
            {tab === "you" && (
              <You themeId={state.themeId} level={level.level} onPickTheme={pickTheme} />
            )}
          </div>
        </div>
      </div>

      {toast && <Toast>{toast}</Toast>}

      {picker && (
        <Sheet
          title="Colourways"
          sub={`You are Level ${level.level} — bolder palettes unlock as you climb`}
          onClose={() => setPicker(false)}
        >
          <ThemePicker value={state.themeId} level={level.level} onChange={pickTheme} />
        </Sheet>
      )}

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
            id: "training",
            label: "Training",
            icon: <NavIcon d="M6.5 6.8v10.4M3.4 9.2v5.6M17.5 6.8v10.4M20.6 9.2v5.6M6.5 12h11" />,
          },
          {
            id: "body",
            label: "Body",
            icon: (
              <NavIcon d="M12 4.4a1.9 1.9 0 1 0 0-.1M8 20.5v-4.2l-1.6-3V9.4h11.2v3.9l-1.6 3v4.2M9.2 9.4 12 7l2.8 2.4" />
            ),
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
    </>
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
