/**
 * The motivation engine.
 *
 * Deliberately not a quote generator. It looks at what is actually true right
 * now — a record you just broke, a streak about to die, a milestone three days
 * away, a body that is recovered and ready — and surfaces the single most
 * motivating *fact*. Specific beats inspirational: "3 days to Centurion" pulls
 * harder than "believe in yourself".
 */

export type MotivationTone = "celebrate" | "push" | "protect" | "ease" | "steady";

export interface MotivationCard {
  tone: MotivationTone;
  icon: string;
  headline: string;
  detail: string;
}

export interface Milestone {
  days: number;
  title: string;
  msg: string;
}

/** Streak milestones, carried over from the original app — the copy was good. */
export const MILESTONES: Milestone[] = [
  { days: 3, title: "Getting started", msg: "Three days. The hardest part is behind you." },
  { days: 7, title: "One week", msg: "A full week. You actually did it." },
  { days: 10, title: "The Consistent", msg: "Ten days. The habit is forming." },
  { days: 14, title: "Two Weeks Strong", msg: "Two weeks. People start to notice." },
  { days: 25, title: "Quarter Century", msg: "25 days. This is becoming who you are." },
  { days: 50, title: "The Disciplined", msg: "50 days. Half a century of showing up." },
  { days: 100, title: "Centurion", msg: "100 days. Most people quit by day three." },
  { days: 200, title: "The Unbreakable", msg: "200 days. You are built different." },
  { days: 365, title: "One Full Year", msg: "365 days. A whole year of showing up." },
];

export interface MilestoneProgress {
  milestone: Milestone;
  remaining: number;
  /** 0..1 through the gap from the previous milestone. */
  progress: number;
}

export function nextMilestone(streak: number): MilestoneProgress | null {
  const idx = MILESTONES.findIndex((m) => m.days > streak);
  if (idx < 0) return null;
  const milestone = MILESTONES[idx];
  const prev = idx > 0 ? MILESTONES[idx - 1].days : 0;
  const span = milestone.days - prev || 1;
  return {
    milestone,
    remaining: milestone.days - streak,
    progress: Math.max(0, Math.min(1, (streak - prev) / span)),
  };
}

export function justHitMilestone(streak: number): Milestone | null {
  return MILESTONES.find((m) => m.days === streak) ?? null;
}

export interface Momentum {
  /** Percentage change against the previous week; null when there is nothing to compare. */
  pct: number | null;
  direction: "up" | "down" | "flat";
}

export function momentum(now: number, previous: number): Momentum {
  if (!previous) {
    if (!now) return { pct: null, direction: "flat" };
    return { pct: null, direction: "up" };
  }
  const pct = Math.round(((now - previous) / previous) * 100);
  return { pct, direction: pct > 4 ? "up" : pct < -4 ? "down" : "flat" };
}

export interface RecentPR {
  exercise: string;
  kind: "weight" | "reps";
  previous: number;
  next: number;
  date: string;
}

export interface MotivationContext {
  todayKey: string;
  /** Local hour, 0–23. */
  hour: number;
  streak: number;
  bestStreak: number;
  habitsDone: number;
  habitsTotal: number;
  /** 0–100, or null when there is no wearable data. */
  recovery: number | null;
  trainedToday: boolean;
  recentPR?: RecentPR | null;
  thisWeekSessions: number;
  lastWeekSessions: number;
  /** Change in fitness age over the last month; negative is good. */
  fitnessAgeDelta?: number | null;
}

/**
 * Pick the most motivating true statement for right now.
 *
 * Order matters: celebrate something real first, protect what is at risk
 * second, then push, then reassure.
 */
export function motivation(ctx: MotivationContext): MotivationCard {
  const {
    streak,
    habitsDone,
    habitsTotal,
    recovery,
    trainedToday,
    recentPR,
    hour,
    thisWeekSessions,
    lastWeekSessions,
    fitnessAgeDelta,
  } = ctx;

  // 1. A record broken today.
  if (recentPR && recentPR.date === ctx.todayKey) {
    const unit = recentPR.kind === "weight" ? "kg" : " reps";
    const gain = Math.round((recentPR.next - recentPR.previous) * 10) / 10;
    return {
      tone: "celebrate",
      icon: "🏆",
      headline: `New PR — ${recentPR.exercise}`,
      detail: `${recentPR.next}${unit}, up ${gain}${unit} on your best. That is the whole point.`,
    };
  }

  // 2. A streak about to die, while there is still time to save it.
  if (streak > 0 && habitsDone === 0 && hour >= 16) {
    return {
      tone: "protect",
      icon: "🔥",
      headline: `Your ${streak}-day streak is on the line`,
      detail:
        habitsTotal > 0
          ? `Nothing logged yet today. One habit keeps it alive — do not throw away ${streak} days.`
          : "Nothing logged yet today. Log something before midnight.",
    };
  }

  // 3. A milestone within touching distance.
  const next = nextMilestone(streak);
  if (next && next.remaining <= 3 && streak > 0) {
    return {
      tone: "push",
      icon: "🎯",
      headline: `${next.remaining} day${next.remaining === 1 ? "" : "s"} to ${next.milestone.title}`,
      detail: `You are on ${streak}. Hold it to ${next.milestone.days} and it is yours.`,
    };
  }

  // 4. Recovered and has not used it.
  if (recovery != null && recovery >= 80 && !trainedToday && hour < 21) {
    return {
      tone: "push",
      icon: "⚡",
      headline: `Recovery ${recovery}% — your body is ready`,
      detail: "This is the day to go hard. Days like this are where progress actually comes from.",
    };
  }

  // 5. Run down — permission to back off is motivating too.
  if (recovery != null && recovery < 45) {
    return {
      tone: "ease",
      icon: "🌙",
      headline: `Recovery ${recovery}% — take it easy`,
      detail: trainedToday
        ? "You have already trained. Eat well, sleep early, come back stronger tomorrow."
        : "Go light today. Resting on purpose is training, not quitting.",
    };
  }

  // 6. Training more than last week.
  const m = momentum(thisWeekSessions, lastWeekSessions);
  if (m.direction === "up" && thisWeekSessions >= 2) {
    return {
      tone: "celebrate",
      icon: "📈",
      headline:
        m.pct != null
          ? `${m.pct}% more training than last week`
          : `${thisWeekSessions} sessions this week`,
      detail: "You are building, not maintaining. Keep the rhythm going.",
    };
  }

  // 7. Fitness age moving the right way.
  if (fitnessAgeDelta != null && fitnessAgeDelta <= -1) {
    const yrs = Math.abs(fitnessAgeDelta);
    return {
      tone: "celebrate",
      icon: "🫀",
      headline: `Fitness age down ${yrs} year${yrs === 1 ? "" : "s"}`,
      detail: "Your heart is measurably younger than it was a month ago. That is real.",
    };
  }

  // 8. Slipping.
  if (m.direction === "down" && lastWeekSessions >= 2) {
    return {
      tone: "push",
      icon: "👊",
      headline: `Behind last week — ${thisWeekSessions} v ${lastWeekSessions} sessions`,
      detail: "Not a failure, just a gap. One session today closes it.",
    };
  }

  // 9. Perfect day already banked.
  if (habitsTotal > 0 && habitsDone === habitsTotal) {
    return {
      tone: "celebrate",
      icon: "✅",
      headline: "Perfect day — everything done",
      detail: streak > 0 ? `That is ${streak} days in a row now.` : "Do it again tomorrow.",
    };
  }

  // 10. Nothing dramatic: point at the next thing worth chasing.
  if (next) {
    const left = habitsTotal - habitsDone;
    return {
      tone: "steady",
      icon: "🧭",
      headline: `${next.remaining} days to ${next.milestone.title}`,
      detail:
        habitsTotal > 0 && left > 0
          ? `${left} habit${left === 1 ? "" : "s"} left today.`
          : "Consistency is the whole game.",
    };
  }
  return {
    tone: "steady",
    icon: "🧭",
    headline: `${streak} days and counting`,
    detail: "You have passed every milestone there is. Now it is just who you are.",
  };
}
