/**
 * Journal: a line about the day and how it felt.
 *
 * Saving is explicit rather than on every keystroke, so a half-typed thought is
 * never what gets stored, and an entry you clear is removed rather than left as
 * an empty husk in the history.
 */

import { useEffect, useMemo, useState } from "react";
import { tick } from "../design/charts";
import { Button, Card, SectionHeader, TextArea } from "../design/primitives";
import { useStore } from "../state/store";
import { useToday } from "../state/useToday";

export const MOODS = [
  { id: "strong", label: "Strong", icon: "💪" },
  { id: "good", label: "Good", icon: "🙂" },
  { id: "ok", label: "OK", icon: "😐" },
  { id: "tired", label: "Tired", icon: "🥱" },
  { id: "low", label: "Low", icon: "🌧️" },
] as const;

function prettyDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function Journal() {
  const { state, dispatch } = useStore();
  const today = useToday();
  const saved = state.notes[today];

  const [text, setText] = useState(saved?.text ?? "");
  const [mood, setMood] = useState<string | undefined>(saved?.mood);
  const [flash, setFlash] = useState<string | null>(null);

  // If the day rolls over while the app is open, start a fresh entry.
  useEffect(() => {
    setText(state.notes[today]?.text ?? "");
    setMood(state.notes[today]?.mood);
  }, [today, state.notes]);

  const dirty = (saved?.text ?? "") !== text || saved?.mood !== mood;

  const history = useMemo(
    () =>
      Object.entries(state.notes)
        .filter(([date]) => date !== today)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 30),
    [state.notes, today],
  );

  const save = () => {
    tick();
    dispatch({ type: "setNote", date: today, note: { text: text.trim(), mood } });
    setFlash(text.trim() ? "Saved" : "Entry cleared");
    setTimeout(() => setFlash(null), 1800);
  };

  return (
    <>
      <SectionHeader title="Today" />
      <Card>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {MOODS.map((m) => (
            <button
              key={m.id}
              className={`moodchip${mood === m.id ? " is-on" : ""}`}
              aria-pressed={mood === m.id}
              onClick={() => {
                tick();
                setMood(mood === m.id ? undefined : m.id);
              }}
            >
              <span aria-hidden>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <TextArea
          rows={5}
          value={text}
          placeholder="What happened today? What is worth remembering?"
          onChange={(e) => setText(e.target.value)}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          <Button variant="primary" onClick={save} disabled={!dirty}>
            {saved ? "Update entry" : "Save entry"}
          </Button>
          {flash && <span style={{ fontSize: 12, color: "var(--m-recovery)" }}>{flash}</span>}
          {!flash && dirty && (
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Unsaved</span>
          )}
        </div>
      </Card>

      <SectionHeader
        title="Earlier"
        right={
          history.length > 0 ? (
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
              {history.length} entr{history.length === 1 ? "y" : "ies"}
            </span>
          ) : undefined
        }
      />
      {history.length === 0 ? (
        <Card>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
            Nothing written yet. One honest line a day is enough — in a month it is the only record
            of what actually changed.
          </div>
        </Card>
      ) : (
        history.map(([date, note]) => {
          const m = MOODS.find((x) => x.id === note.mood);
          return (
            <Card key={date}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: note.text ? 8 : 0,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>
                  {prettyDate(date)}
                </span>
                {m && (
                  <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                    <span aria-hidden>{m.icon}</span> {m.label}
                  </span>
                )}
              </div>
              {note.text && (
                <div style={{ fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {note.text}
                </div>
              )}
            </Card>
          );
        })
      )}
    </>
  );
}
