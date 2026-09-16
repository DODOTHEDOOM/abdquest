/**
 * Training log — every session you do, whatever the sport.
 *
 * Carried over from the original app's workout system, which got the important
 * things right: an exercise library that remembers what you lifted last time,
 * personal records per exercise, and bodyweight movements measured in reps
 * rather than pretending they have a weight.
 */

export type ActivityKind = "gym" | "cardio" | "sport" | "other";

export interface Activity {
  id: string;
  name: string;
  icon: string;
  kind: ActivityKind;
  /** Which metric hue represents it. */
  color: string;
}

export const ACTIVITIES: Activity[] = [
  { id: "gym", name: "Gym", icon: "🏋️", kind: "gym", color: "var(--m-strain)" },
  { id: "run", name: "Run", icon: "🏃", kind: "cardio", color: "var(--m-recovery)" },
  { id: "walk", name: "Walk", icon: "🚶", kind: "cardio", color: "var(--m-habits)" },
  { id: "cycle", name: "Cycle", icon: "🚴", kind: "cardio", color: "var(--m-fitness)" },
  { id: "swim", name: "Swim", icon: "🏊", kind: "cardio", color: "var(--m-fitness)" },
  { id: "rope", name: "Jump rope", icon: "🪢", kind: "cardio", color: "var(--m-sleep)" },
  { id: "row", name: "Rowing", icon: "🚣", kind: "cardio", color: "var(--m-fitness)" },
  { id: "hike", name: "Hike", icon: "🥾", kind: "cardio", color: "var(--m-habits)" },
  { id: "football", name: "Football", icon: "⚽", kind: "sport", color: "var(--m-habits)" },
  { id: "basketball", name: "Basketball", icon: "🏀", kind: "sport", color: "var(--m-strain)" },
  { id: "tennis", name: "Tennis", icon: "🎾", kind: "sport", color: "var(--m-habits)" },
  { id: "padel", name: "Padel", icon: "🥎", kind: "sport", color: "var(--m-recovery)" },
  { id: "boxing", name: "Boxing", icon: "🥊", kind: "sport", color: "var(--danger)" },
  { id: "martial", name: "Martial arts", icon: "🥋", kind: "sport", color: "var(--m-sleep)" },
  { id: "climb", name: "Climbing", icon: "🧗", kind: "sport", color: "var(--m-strain)" },
  { id: "yoga", name: "Yoga / mobility", icon: "🧘", kind: "other", color: "var(--m-sleep)" },
  { id: "other", name: "Something else", icon: "⚡", kind: "other", color: "var(--text-dim)" },
];

export function activityById(id: string): Activity {
  return ACTIVITIES.find((a) => a.id === id) ?? ACTIVITIES[ACTIVITIES.length - 1];
}

export type Intensity = "easy" | "steady" | "hard" | "max";

export const INTENSITIES: { id: Intensity; label: string; factor: number }[] = [
  { id: "easy", label: "Easy", factor: 0.5 },
  { id: "steady", label: "Steady", factor: 1 },
  { id: "hard", label: "Hard", factor: 1.6 },
  { id: "max", label: "All out", factor: 2.2 },
];

export type GymMetric = "weight" | "bodyweight";

export interface GymSet {
  reps: number;
  /** kg. Always 0 for bodyweight movements. */
  weight: number;
}

interface SessionBase {
  id: string;
  /** Local YYYY-MM-DD. */
  date: string;
  activityId: string;
  note?: string;
  /** Imported from a watch rather than logged by hand. */
  auto?: boolean;
}

export interface GymSession extends SessionBase {
  kind: "gym";
  exerciseId: string;
  name: string;
  metric: GymMetric;
  sets: GymSet[];
}

export interface EffortSession extends SessionBase {
  kind: "cardio" | "sport" | "other";
  name?: string;
  minutes: number;
  distanceKm?: number;
  intensity?: Intensity;
  calories?: number;
  avgHr?: number;
}

export type Session = GymSession | EffortSession;

/** One movement in your library, with everything you have ever done on it. */
export interface Exercise {
  id: string;
  name: string;
  metric: GymMetric;
  /** date -> the sets you did that day. */
  history: Record<string, GymSet[]>;
  lastSets?: GymSet[];
  lastDate?: string;
  pr: { weight: number; reps: number; date?: string };
}

// ── Set maths ───────────────────────────────────────────────────────────────

/** Total kilograms moved: the standard tonnage measure of a session. */
export function volumeOf(sets: GymSet[]): number {
  return sets.reduce((t, s) => t + (s.reps || 0) * (s.weight || 0), 0);
}

export function topWeight(sets: GymSet[]): number {
  return sets.reduce((m, s) => Math.max(m, s.weight || 0), 0);
}

export function topReps(sets: GymSet[]): number {
  return sets.reduce((m, s) => Math.max(m, s.reps || 0), 0);
}

/**
 * Estimated one-rep max (Epley). Useful for comparing a heavy triple against a
 * lighter set of ten — raw top weight alone hides real progress.
 */
export function epley1RM(sets: GymSet[]): number {
  let best = 0;
  for (const s of sets) {
    if (!s.weight || !s.reps) continue;
    const est = s.weight * (1 + s.reps / 30);
    if (est > best) best = est;
  }
  return Math.round(best * 10) / 10;
}

export function sessionVolume(s: Session): number {
  return s.kind === "gym" ? volumeOf(s.sets) : 0;
}

/** Gym sessions have no clock, so estimate roughly three minutes per set. */
export function sessionMinutes(s: Session): number {
  return s.kind === "gym" ? s.sets.length * 3 : s.minutes || 0;
}

// ── Personal records ────────────────────────────────────────────────────────

export interface PRResult {
  isPR: boolean;
  /** Weighted movements are judged on top weight, bodyweight ones on top reps. */
  kind: "weight" | "reps";
  previous: number;
  next: number;
}

export function checkPR(
  exercise: Exercise | undefined,
  sets: GymSet[],
  metric: GymMetric,
): PRResult {
  const kind = metric === "bodyweight" ? "reps" : "weight";
  const next = kind === "reps" ? topReps(sets) : topWeight(sets);
  const previous = kind === "reps" ? (exercise?.pr.reps ?? 0) : (exercise?.pr.weight ?? 0);
  return { isPR: next > previous && next > 0, kind, previous, next };
}

/** Fold a gym session into the library: history, last sets and any new record. */
export function applyGymSession(library: Exercise[], session: GymSession): Exercise[] {
  const out = library.slice();
  const i = out.findIndex((e) => e.id === session.exerciseId);
  const existing = i >= 0 ? out[i] : undefined;
  const pr = checkPR(existing, session.sets, session.metric);

  const entry: Exercise = {
    id: session.exerciseId,
    name: session.name,
    metric: session.metric,
    history: { ...(existing?.history ?? {}), [session.date]: session.sets },
    lastSets: session.sets,
    lastDate: session.date,
    pr: pr.isPR
      ? {
          weight: session.metric === "bodyweight" ? 0 : pr.next,
          reps: session.metric === "bodyweight" ? pr.next : topReps(session.sets),
          date: session.date,
        }
      : (existing?.pr ?? { weight: 0, reps: 0 }),
  };

  if (i >= 0) out[i] = entry;
  else out.push(entry);
  return out;
}

/**
 * The best you had done *before* your current record — the number the PR beat.
 * Without this a first-ever record reads as "up 110kg on your best".
 */
export function previousBest(ex: Exercise): number {
  if (!ex.pr.date) return 0;
  const isBodyweight = ex.metric === "bodyweight";
  let best = 0;
  for (const [date, sets] of Object.entries(ex.history)) {
    if (date >= ex.pr.date) continue;
    best = Math.max(best, isBodyweight ? topReps(sets) : topWeight(sets));
  }
  return best;
}

/** Rebuild a library from a list of sessions, oldest first. */
export function libraryFromSessions(sessions: Session[]): Exercise[] {
  let lib: Exercise[] = [];
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (s.kind === "gym") lib = applyGymSession(lib, s);
  }
  return lib;
}

// ── Weeks ───────────────────────────────────────────────────────────────────

/** Monday of the week containing `dateKey`, as YYYY-MM-DD. */
export function weekStartOf(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const shift = (dt.getDay() + 6) % 7; // Monday = 0
  dt.setDate(dt.getDate() - shift);
  return key(dt);
}

function key(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function addDays(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return key(dt);
}

export interface WeekStats {
  start: string;
  label: string;
  sessions: number;
  minutes: number;
  volume: number;
  byKind: Record<ActivityKind, number>;
}

export function weekStats(sessions: Session[], startKey: string): WeekStats {
  const end = addDays(startKey, 7);
  const inWeek = sessions.filter((s) => s.date >= startKey && s.date < end);
  const byKind: Record<ActivityKind, number> = { gym: 0, cardio: 0, sport: 0, other: 0 };
  let minutes = 0;
  let volume = 0;
  for (const s of inWeek) {
    byKind[activityById(s.activityId).kind]++;
    minutes += sessionMinutes(s);
    volume += sessionVolume(s);
  }
  const [, mo, d] = startKey.split("-");
  return {
    start: startKey,
    label: `${d}/${mo}`,
    sessions: inWeek.length,
    minutes,
    volume: Math.round(volume),
    byKind,
  };
}

/** The last `count` weeks, oldest first, ending with the week containing `todayKey`. */
export function weeklySeries(sessions: Session[], todayKey: string, count = 6): WeekStats[] {
  const thisWeek = weekStartOf(todayKey);
  const out: WeekStats[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(weekStats(sessions, addDays(thisWeek, -7 * i)));
  return out;
}

export function sessionsOn(sessions: Session[], dateKey: string): Session[] {
  return sessions.filter((s) => s.date === dateKey);
}

// ── Display ─────────────────────────────────────────────────────────────────

/** The one-line summary under a session's name. */
export function sessionHeadline(s: Session): string {
  if (s.kind === "gym") {
    const setLabel = `${s.sets.length} set${s.sets.length === 1 ? "" : "s"}`;
    return s.metric === "bodyweight"
      ? `${setLabel} · ${topReps(s.sets)} top reps`
      : `${setLabel} · ${topWeight(s.sets)}kg top · ${Math.round(volumeOf(s.sets))}kg total`;
  }
  const bits: string[] = [];
  if (s.minutes) bits.push(`${s.minutes} min`);
  if (s.distanceKm) bits.push(`${s.distanceKm} km`);
  if (s.calories) bits.push(`${s.calories} kcal`);
  if (s.avgHr) bits.push(`${s.avgHr} bpm`);
  if (s.intensity) bits.push(INTENSITIES.find((x) => x.id === s.intensity)?.label ?? s.intensity);
  return bits.join(" · ") || activityById(s.activityId).name;
}

/** "10×60kg · 8×70kg" — what you did last time, the prompt to beat it. */
export function setsSummary(sets: GymSet[], metric: GymMetric): string {
  return sets
    .map((s) => (metric === "bodyweight" ? `${s.reps} reps` : `${s.reps}×${s.weight}kg`))
    .join("  ·  ");
}
