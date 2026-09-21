import { useMemo, useState } from "react";
import { Badge, Button, Card, Field, SectionHeader, Sheet, TextInput } from "../design/primitives";
import { BarStrip, tick } from "../design/charts";
import { useStore } from "../state/store";
import { useToday } from "../state/useToday";
import {
  ACTIVITIES,
  activityById,
  applyGymSession,
  checkPR,
  epley1RM,
  INTENSITIES,
  libraryFromSessions,
  sessionHeadline,
  sessionsOn,
  setsSummary,
  topReps,
  topWeight,
  volumeOf,
  weeklySeries,
  type Exercise,
  type GymSet,
  type Intensity,
  type Session,
} from "../lib/training";

type SheetState =
  | null
  | { mode: "pick" }
  | { mode: "gym"; exercise?: Exercise }
  | { mode: "effort"; activityId: string }
  | { mode: "history"; exercise: Exercise };

export function Training() {
  const today = useToday();
  const { state, dispatch } = useStore();
  const sessions = state.sessions;
  const [sheet, setSheet] = useState<SheetState>(null);
  const [pr, setPr] = useState<{ name: string; kind: string; next: number } | null>(null);

  const library = useMemo(() => libraryFromSessions(sessions), [sessions]);
  const weeks = useMemo(() => weeklySeries(sessions, today, 6), [sessions, today]);
  const thisWeek = weeks[weeks.length - 1];
  const lastWeek = weeks[weeks.length - 2];
  const todays = sessionsOn(sessions, today);

  function addSession(s: Session) {
    dispatch({ type: "addSession", session: s });
    setSheet(null);
  }

  return (
    <>
      {pr && (
        <div className="prbanner" onClick={() => setPr(null)}>
          <span style={{ fontSize: 22 }}>🏆</span>
          <span>
            <strong>New personal record</strong>
            <br />
            {pr.name} — {pr.next}
            {pr.kind === "weight" ? "kg" : " reps"}
          </span>
        </div>
      )}

      <SectionHeader title="This week" />
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <Stat label="Sessions" value={String(thisWeek.sessions)} />
          <Stat label="Minutes" value={String(thisWeek.minutes)} />
          <Stat label="Volume" value={`${(thisWeek.volume / 1000).toFixed(1)}t`} />
        </div>
        {lastWeek && (
          <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 12 }}>
            {thisWeek.sessions >= lastWeek.sessions
              ? `${thisWeek.sessions - lastWeek.sessions} more than last week`
              : `${lastWeek.sessions - thisWeek.sessions} fewer than last week`}
            {" · "}
            {Object.entries(thisWeek.byKind)
              .filter(([, n]) => n > 0)
              .map(([k, n]) => `${n} ${k}`)
              .join(", ") || "nothing logged yet"}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginBottom: 10 }}>
            Sessions · last 6 weeks
          </div>
          <BarStrip
            values={weeks.map((w) => w.sessions)}
            labels={weeks.map((w) => w.label)}
            color="var(--m-strain)"
            height={64}
            format={(v) => `${v} session${v === 1 ? "" : "s"}`}
          />
        </div>
      </Card>

      <div style={{ marginTop: 14 }}>
        <Button
          variant="primary"
          block
          onClick={() => {
            tick();
            setSheet({ mode: "pick" });
          }}
        >
          + Log a session
        </Button>
      </div>

      <SectionHeader title="Today" />
      {todays.length === 0 ? (
        <Card>
          <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
            Nothing logged yet today. Gym, a run, a swim, five-a-side — it all counts.
          </div>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {todays.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </div>
      )}

      <SectionHeader title="Your lifts" />
      {library.length === 0 ? (
        <Card>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Log a gym session and your movements will build up here, with every record you set.
          </div>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {library.map((ex) => (
            <Card
              key={ex.id}
              chevron
              onClick={() => setSheet({ mode: "history", exercise: ex })}
              ariaLabel={`${ex.name} history`}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>{ex.metric === "bodyweight" ? "🤸" : "🏋️"}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>
                    {ex.name}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--text-faint)" }}>
                    {ex.lastSets
                      ? `Last: ${setsSummary(ex.lastSets, ex.metric)}`
                      : "Not logged yet"}
                  </span>
                </span>
                <Badge tone="accent">
                  PR {ex.metric === "bodyweight" ? `${ex.pr.reps} reps` : `${ex.pr.weight}kg`}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {sheet?.mode === "pick" && (
        <Sheet title="What did you do?" onClose={() => setSheet(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {ACTIVITIES.map((a) => (
              <button
                key={a.id}
                type="button"
                className="actbtn"
                onClick={() => {
                  tick();
                  setSheet(
                    a.kind === "gym" ? { mode: "gym" } : { mode: "effort", activityId: a.id },
                  );
                }}
              >
                <span style={{ fontSize: 26 }}>{a.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{a.name}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet?.mode === "gym" && (
        <GymForm
          library={library}
          date={today}
          onCancel={() => setSheet(null)}
          onSave={(session, prHit) => {
            addSession(session);
            if (prHit) setPr(prHit);
          }}
        />
      )}

      {sheet?.mode === "effort" && (
        <EffortForm
          activityId={sheet.activityId}
          date={today}
          onCancel={() => setSheet(null)}
          onSave={addSession}
        />
      )}

      {sheet?.mode === "history" && (
        <HistorySheet exercise={sheet.exercise} onClose={() => setSheet(null)} />
      )}
    </>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--text-dim)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

function SessionRow({ session }: { session: Session }) {
  const a = activityById(session.activityId);
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            fontSize: 20,
            background: "color-mix(in srgb, var(--m-strain) 14%, transparent)",
            flexShrink: 0,
          }}
        >
          {a.icon}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>
            {session.kind === "gym" ? session.name : a.name}
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--text-faint)" }}>
            {sessionHeadline(session)}
          </span>
        </span>
      </div>
    </Card>
  );
}

function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="stepper">
      <button
        type="button"
        onClick={() => {
          tick();
          onChange(Math.max(min, Math.round((value - step) * 100) / 100));
        }}
        aria-label="Decrease"
      >
        −
      </button>
      <span>
        {value}
        {suffix && <i>{suffix}</i>}
      </span>
      <button
        type="button"
        onClick={() => {
          tick();
          onChange(Math.round((value + step) * 100) / 100);
        }}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

function GymForm({
  library,
  date,
  onCancel,
  onSave,
}: {
  library: Exercise[];
  date: string;
  onCancel: () => void;
  onSave: (s: Session, pr: { name: string; kind: string; next: number } | null) => void;
}) {
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [newName, setNewName] = useState("");
  const [bodyweight, setBodyweight] = useState(false);
  const [sets, setSets] = useState<GymSet[]>([{ reps: 10, weight: 40 }]);

  function choose(ex: Exercise) {
    setPicked(ex);
    setBodyweight(ex.metric === "bodyweight");
    setSets(ex.lastSets?.length ? ex.lastSets.map((s) => ({ ...s })) : [{ reps: 10, weight: 40 }]);
  }

  const metric = bodyweight ? "bodyweight" : "weight";
  const name = picked?.name ?? newName.trim();
  const canSave = name.length > 0 && sets.length > 0;

  if (!picked && !newName) {
    return (
      <Sheet title="Which movement?" onClose={onCancel}>
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {library.map((ex) => (
            <button key={ex.id} type="button" className="pickrow" onClick={() => choose(ex)}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>{ex.name}</strong>
                <span style={{ display: "block", fontSize: 11, color: "var(--text-faint)" }}>
                  {ex.lastSets ? setsSummary(ex.lastSets, ex.metric) : "No history yet"}
                </span>
              </span>
              <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700 }}>
                PR {ex.metric === "bodyweight" ? `${ex.pr.reps}r` : `${ex.pr.weight}kg`}
              </span>
            </button>
          ))}
        </div>
        <Field label="Or add a new movement">
          <TextInput
            placeholder="e.g. Incline dumbbell press"
            onChange={(e) => setNewName(e.target.value)}
          />
        </Field>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={name || "New movement"}
      sub={
        picked?.lastSets ? `Last time: ${setsSummary(picked.lastSets, picked.metric)}` : undefined
      }
      onClose={onCancel}
    >
      {!picked && (
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <input
            type="checkbox"
            checked={bodyweight}
            onChange={(e) => setBodyweight(e.target.checked)}
          />
          <span style={{ fontSize: 13 }}>Bodyweight movement (tracked in reps)</span>
        </label>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {sets.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="setno">{i + 1}</span>
            <Stepper
              value={s.reps}
              onChange={(v) => setSets(sets.map((x, j) => (j === i ? { ...x, reps: v } : x)))}
              suffix=" reps"
            />
            {!bodyweight && (
              <Stepper
                value={s.weight}
                step={2.5}
                onChange={(v) => setSets(sets.map((x, j) => (j === i ? { ...x, weight: v } : x)))}
                suffix="kg"
              />
            )}
            {sets.length > 1 && (
              <button
                type="button"
                className="setdel"
                onClick={() => setSets(sets.filter((_, j) => j !== i))}
                aria-label={`Remove set ${i + 1}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <Button
          variant="ghost"
          block
          sm
          onClick={() => setSets([...sets, { ...sets[sets.length - 1] }])}
        >
          + Add set
        </Button>
      </div>

      {!bodyweight && (
        <div
          style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 12, textAlign: "center" }}
        >
          {Math.round(volumeOf(sets))}kg total · top set {topWeight(sets)}kg · est. 1RM{" "}
          {epley1RM(sets)}kg
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Button
          variant="primary"
          block
          disabled={!canSave}
          onClick={() => {
            const exerciseId = picked?.id ?? `ex_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
            const clean = bodyweight ? sets.map((s) => ({ ...s, weight: 0 })) : sets;
            const session: Session = {
              id: `g_${date}_${exerciseId}_${Date.now()}`,
              date,
              activityId: "gym",
              kind: "gym",
              exerciseId,
              name,
              metric,
              sets: clean,
            };
            const hit = checkPR(picked ?? undefined, clean, metric);
            // Fold it in so the caller's library stays consistent even before re-render.
            applyGymSession(picked ? [picked] : [], session);
            onSave(session, hit.isPR ? { name, kind: hit.kind, next: hit.next } : null);
          }}
        >
          Save session
        </Button>
      </div>
    </Sheet>
  );
}

function EffortForm({
  activityId,
  date,
  onCancel,
  onSave,
}: {
  activityId: string;
  date: string;
  onCancel: () => void;
  onSave: (s: Session) => void;
}) {
  const a = activityById(activityId);
  const [minutes, setMinutes] = useState(a.kind === "sport" ? 60 : 30);
  const [distance, setDistance] = useState(0);
  const [intensity, setIntensity] = useState<Intensity>("steady");

  return (
    <Sheet title={a.name} sub={`${a.icon} ${date}`} onClose={onCancel}>
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <div className="field__label">Minutes</div>
          <Stepper value={minutes} step={5} onChange={setMinutes} suffix=" min" />
        </div>
        {a.kind === "cardio" && (
          <div>
            <div className="field__label">Distance</div>
            <Stepper value={distance} step={0.5} onChange={setDistance} suffix=" km" />
          </div>
        )}
        <div>
          <div className="field__label">How hard was it?</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {INTENSITIES.map((x) => (
              <button
                key={x.id}
                type="button"
                className="intbtn"
                aria-pressed={intensity === x.id}
                onClick={() => {
                  tick();
                  setIntensity(x.id);
                }}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        <Button
          variant="primary"
          block
          disabled={minutes <= 0}
          onClick={() =>
            onSave({
              id: `e_${date}_${activityId}_${Date.now()}`,
              date,
              activityId,
              kind: a.kind === "sport" ? "sport" : a.kind === "cardio" ? "cardio" : "other",
              minutes,
              distanceKm: distance > 0 ? distance : undefined,
              intensity,
            })
          }
        >
          Save session
        </Button>
      </div>
    </Sheet>
  );
}

function HistorySheet({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const dates = Object.keys(exercise.history).sort();
  const series = dates.map((d) =>
    exercise.metric === "bodyweight"
      ? topReps(exercise.history[d])
      : topWeight(exercise.history[d]),
  );
  const unit = exercise.metric === "bodyweight" ? " reps" : "kg";

  return (
    <Sheet
      title={exercise.name}
      sub={`${dates.length} session${dates.length === 1 ? "" : "s"} logged`}
      onClose={onClose}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <Card>
          <div style={{ fontSize: 10.5, color: "var(--text-dim)", fontWeight: 600 }}>
            Personal record
          </div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {exercise.metric === "bodyweight" ? exercise.pr.reps : exercise.pr.weight}
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{unit}</span>
          </div>
          {exercise.pr.date && (
            <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{exercise.pr.date}</div>
          )}
        </Card>
        <Card>
          <div style={{ fontSize: 10.5, color: "var(--text-dim)", fontWeight: 600 }}>Last time</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6, lineHeight: 1.4 }}>
            {exercise.lastSets ? setsSummary(exercise.lastSets, exercise.metric) : "—"}
          </div>
        </Card>
      </div>

      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>
        Top set per session — tap a bar
      </div>
      <BarStrip values={series} color="var(--m-strain)" height={68} format={(v) => `${v}${unit}`} />
    </Sheet>
  );
}
