import { useState } from "react";
import { Badge, Card, ProgressBar, SectionHeader, Sheet } from "../design/primitives";
import { BarStrip, tick } from "../design/charts";

interface Habit {
  id: string;
  name: string;
  detail: string;
  streak: number;
  history: number[]; // 1 = done, 0 = missed, per day (oldest first)
}

const HABITS: Habit[] = [
  {
    id: "move",
    name: "Move for 20 minutes",
    detail: "Walk, gym, anything that raises your heart rate.",
    streak: 12,
    history: [1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
  },
  {
    id: "junk",
    name: "No junk food",
    detail: "No crisps, takeaway or binge snacking.",
    streak: 5,
    history: [1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    id: "sleep",
    name: "In bed before 1am",
    detail: "Lights out — being in bed scrolling doesn't count.",
    streak: 0,
    history: [1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],
  },
  {
    id: "water",
    name: "Drink 3L of water",
    detail: "Roughly six large glasses across the day.",
    streak: 2,
    history: [0, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1],
  },
  {
    id: "read",
    name: "Read 20 minutes",
    detail: "Book, article, anything that isn't a feed.",
    streak: 8,
    history: [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
];

export function Habits() {
  const [done, setDone] = useState<Record<string, boolean>>({ move: true, junk: true });
  const [open, setOpen] = useState<Habit | null>(null);
  const doneCount = HABITS.filter((h) => done[h.id]).length;
  const pct = doneCount / HABITS.length;

  return (
    <>
      <SectionHeader title="Today" />
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 26, fontWeight: 700 }}>
            {doneCount}
            <span style={{ fontSize: 15, color: "var(--text-dim)", fontWeight: 600 }}>
              {" "}
              of {HABITS.length}
            </span>
          </span>
          <Badge tone={pct === 1 ? "accent" : "neutral"}>
            {pct === 1 ? "Perfect day" : `${Math.round(pct * 100)}%`}
          </Badge>
        </div>
        <div style={{ marginTop: 12 }}>
          <ProgressBar value={pct} color="var(--m-habits)" ariaLabel="Habits complete" />
        </div>
      </Card>

      <SectionHeader title="Your habits" />
      <div style={{ display: "grid", gap: 10 }}>
        {HABITS.map((hbt) => {
          const isDone = !!done[hbt.id];
          return (
            <Card key={hbt.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  aria-label={isDone ? `Mark ${hbt.name} not done` : `Mark ${hbt.name} done`}
                  onClick={() => {
                    tick(12);
                    setDone((d) => ({ ...d, [hbt.id]: !d[hbt.id] }));
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
                    setOpen(hbt);
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
                    {hbt.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>
                    {hbt.streak > 0
                      ? `🔥 ${hbt.streak}-day streak`
                      : "Streak broken — restart today"}
                  </div>
                </button>
                <div style={{ width: 76, flexShrink: 0 }}>
                  <BarStrip
                    values={hbt.history.slice(-7)}
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
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}
          >
            <Card>
              <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}>
                Current streak
              </div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{open.streak}</div>
            </Card>
            <Card>
              <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}>
                Last 14 days
              </div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>
                {Math.round((open.history.filter(Boolean).length / open.history.length) * 100)}%
              </div>
            </Card>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>
            Completion · 14 days — tap a day
          </div>
          <BarStrip
            values={open.history}
            color="var(--m-habits)"
            height={52}
            max={1}
            format={(v) => (v ? "Done" : "Missed")}
          />
        </Sheet>
      )}
    </>
  );
}
