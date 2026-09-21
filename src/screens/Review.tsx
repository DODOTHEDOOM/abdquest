/**
 * The weekly review, today's focus list, and the badge shelf.
 *
 * Every number here is derived from what happened. There is nothing to claim
 * and nothing stored, so nothing can disagree with the rest of the app.
 */

import { useMemo } from "react";
import { Badge as Chip, Card, ProgressBar, SectionHeader } from "../design/primitives";
import {
  badgesFor,
  dailyChallenges,
  sortBadges,
  weeklyChallenges,
  type Challenge,
} from "../lib/achievements";
import { recentWeeks, weeklyReview } from "../lib/weeklyReview";
import { libraryOf } from "../state/schema";
import { useStore } from "../state/store";
import { useToday } from "../state/useToday";

function prettyWeek(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  const f = (dt: Date) => dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${f(start)} – ${f(end)}`;
}

function ChallengeRow({ c }: { c: Challenge }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0" }}>
      <span className={`tickbox${c.done ? " is-done" : ""}`} aria-hidden>
        {c.done ? "✓" : ""}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            display: "block",
            opacity: c.done ? 0.6 : 1,
            textDecoration: c.done ? "line-through" : "none",
          }}
        >
          {c.label}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{c.detail}</span>
      </span>
    </div>
  );
}

export function Review() {
  const { state } = useStore();
  const today = useToday();

  const review = useMemo(() => weeklyReview(state, today), [state, today]);
  const history = useMemo(() => recentWeeks(state, today, 8).slice(1), [state, today]);
  const daily = useMemo(() => dailyChallenges(state, today), [state, today]);
  const weekly = useMemo(() => weeklyChallenges(state, today), [state, today]);
  const badges = useMemo(() => sortBadges(badgesFor(state, libraryOf(state))), [state]);
  const earned = badges.filter((b) => b.earned).length;

  return (
    <>
      {/* ── This week ───────────────────────────────────────────────────── */}
      <SectionHeader
        title="This week"
        right={
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
            {review.daysElapsed} day{review.daysElapsed === 1 ? "" : "s"} in
          </span>
        }
      />
      <Card>
        {review.score === null ? (
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
            Nothing tracked this week yet. Tick a habit or log a session and the review builds
            itself.
          </div>
        ) : (
          <>
            <div
              style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}
            >
              <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1 }}>
                {review.score}
                <span style={{ fontSize: 16, color: "var(--text-dim)", fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{review.label}</div>
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              {review.parts.map((p) => (
                <div key={p.key}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{p.label}</span>
                    <span style={{ color: "var(--text-dim)" }}>{p.detail}</span>
                  </div>
                  <ProgressBar value={p.of ? Math.min(1, p.hit / p.of) : 0} />
                </div>
              ))}
            </div>
            <div
              style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 14, lineHeight: 1.6 }}
            >
              Measured over the {review.daysElapsed} day{review.daysElapsed === 1 ? "" : "s"} of
              this week so far, not a full seven — a week in progress is not a week you failed.
            </div>
          </>
        )}
      </Card>

      {/* ── Today ───────────────────────────────────────────────────────── */}
      {daily.length > 0 && (
        <>
          <SectionHeader
            title="Today"
            right={
              <Chip tone={daily.every((c) => c.done) ? "accent" : "neutral"}>
                {daily.filter((c) => c.done).length}/{daily.length}
              </Chip>
            }
          />
          <Card>
            {daily.map((c) => (
              <ChallengeRow key={c.id} c={c} />
            ))}
          </Card>
        </>
      )}

      {/* ── This week's targets ─────────────────────────────────────────── */}
      {weekly.length > 0 && (
        <>
          <SectionHeader title="Week targets" />
          <Card>
            {weekly.map((c) => (
              <ChallengeRow key={c.id} c={c} />
            ))}
          </Card>
        </>
      )}

      {/* ── Badges ──────────────────────────────────────────────────────── */}
      <SectionHeader
        title="Badges"
        right={
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
            {earned} of {badges.length}
          </span>
        }
      />
      <Card>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
            gap: 10,
          }}
        >
          {badges.map((b) => (
            <div key={b.id} className={`badgetile${b.earned ? " is-earned" : ""}`} title={b.detail}>
              <span className="badgetile__icon" aria-hidden>
                {b.icon}
              </span>
              <span className="badgetile__name">{b.name}</span>
              <span className="badgetile__meta">{b.earned ? "Earned" : `${b.have}/${b.need}`}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Past weeks ──────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <>
          <SectionHeader title="Past weeks" />
          {history.map((w) => (
            <Card key={w.weekStart}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{prettyWeek(w.weekStart)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>
                    {w.label}
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {w.score === null ? "—" : `${w.score}%`}
                </div>
              </div>
            </Card>
          ))}
        </>
      )}
    </>
  );
}
