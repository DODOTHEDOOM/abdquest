import { useMemo, useState } from "react";
import { Badge, Card, ProgressBar, SectionHeader, Sheet } from "../design/primitives";
import { BarStrip, tick } from "../design/charts";
import { ymd } from "../lib/dates";
import { isPerfectDay, type AppState, type Habit } from "../state/schema";
import { useStore } from "../state/store";

function shift(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** 1 for done, 0 for missed, oldest first. */
function historyFor(state: AppState, habitId: string, today: string, days: number): number[] {
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(state.done[shift(today, -i)]?.[habitId] ? 1 : 0);
  }
  return out;
}

/** Consecutive days ending today, or ending yesterday while today is still open. */
function streakFor(state: AppState, habitId: string, today: string): number {
  let cursor = state.done[today]?.[habitId] ? today : shift(today, -1);
  let n = 0;
  while (state.done[cursor]?.[habitId]) {
    n++;
    cursor = shift(cursor, -1);
    if (n > 3650) break;
  }
  return n;
}

export function Habits() {
  const { state, dispatch } = useStore();
  const today = ymd(new Date());
  const [open, setOpen] = useState<Habit | null>(null);

  const doneMap = state.done[today] ?? {};
  const required = state.habits.filter((h) => !h.bonus);
  const doneCount = state.habits.filter((h) => doneMap[h.id]).length;
  const requiredDone = required.filter((h) => doneMap[h.id]).length;
  const pct = required.length ? requiredDone / required.length : 0;
  const perfect = isPerfectDay(state, today);

  const rows = useMemo(
    () =>
      state.habits.map((h) => ({
        habit: h,
        streak: streakFor(state, h.id, today),
        history: historyFor(state, h.id, today, 14),
      })),
    [state, today],
  );

  if (!state.habits.length) {
    return (
      <Card>
        <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
          No habits yet. Once your habits come across from the old app they will appear here.
        </div>
      </Card>
    );
  }

  return (
    <>
      <SectionHeader title="Today" />
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 26, fontWeight: 800 }}>
            {doneCount}
            <span style={{ fontSize: 15, color: "var(--text-dim)", fontWeight: 600 }}>
              {" "}
              of {state.habits.length}
            </span>
          </span>
          <Badge tone={perfect ? "accent" : "neutral"}>
            {perfect ? "Perfect day" : `${Math.round(pct * 100)}%`}
          </Badge>
        </div>
        <div style={{ marginTop: 12 }}>
          <ProgressBar value={pct} color="var(--m-habits)" ariaLabel="Habits complete" />
        </div>
        {state.streak.current > 0 && (
          <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 10 }}>
            {state.streak.current}-day streak · best {state.streak.best}
          </div>
        )}
      </Card>

      <SectionHeader title="Your habits" />
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map(({ habit, streak, history }) => {
          const isDone = !!doneMap[habit.id];
          return (
            <Card key={habit.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  aria-label={isDone ? `Mark ${habit.name} not done` : `Mark ${habit.name} done`}
                  onClick={() => {
                    tick(12);
                    dispatch({ type: "toggleHabit", date: today, habitId: habit.id });
                  }}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    border: "2px solid",
                    borderColor: isDone ? "var(--m-habits)" : "var(--border-strong)",
                    background: isDone ? "var(--m-habits)" : "transparent",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 15,
                    flexShrink: 0,
                    cursor: "pointer",
                    boxShadow: isDone ? "var(--elev-2)" : "none",
                    transition: "all .16s cubic-bezier(.2,.8,.3,1)",
                  }}
                >
                  {isDone ? "✓" : ""}
                </button>
                <button
                  onClick={() => {
                    tick();
                    setOpen(habit);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: isDone ? "var(--text-dim)" : "var(--text)",
                      textDecoration: isDone ? "line-through" : "none",
                    }}
                  >
                    {habit.icon ? `${habit.icon} ` : ""}
                    {habit.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>
                    {habit.bonus
                      ? "Bonus — does not break a perfect day"
                      : streak > 0
                        ? `${streak}-day streak`
                        : "Start a streak today"}
                  </div>
                </button>
                <div style={{ width: 76, flexShrink: 0 }}>
                  <BarStrip
                    values={history.slice(-7)}
                    color="var(--m-habits)"
                    height={26}
                    max={1}
                    interactive={false}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {open && (
        <Sheet title={open.name} sub={open.detail} onClose={() => setOpen(null)}>
          <HabitDetail state={state} habit={open} today={today} />
        </Sheet>
      )}
    </>
  );
}

function HabitDetail({ state, habit, today }: { state: AppState; habit: Habit; today: string }) {
  const history = historyFor(state, habit.id, today, 14);
  const hit = history.filter(Boolean).length;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
        <Card>
          <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}>
            Current streak
          </div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{streakFor(state, habit.id, today)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}>
            Last 14 days
          </div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>
            {Math.round((hit / history.length) * 100)}%
          </div>
        </Card>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>
        Completion · 14 days — tap a day
      </div>
      <BarStrip
        values={history}
        color="var(--m-habits)"
        height={52}
        max={1}
        format={(v) => (v ? "Done" : "Missed")}
      />
    </>
  );
}
