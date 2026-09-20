/**
 * Managing habits: add, rename, mark as bonus, retire.
 *
 * Retiring is not deleting. The habit stops being tracked from now on, but
 * every day it was already ticked stays in the record, so old streaks and past
 * weeks still read the way they actually happened.
 */

import { useState } from "react";
import { tick } from "../design/charts";
import { Button, Card, Field, TextInput } from "../design/primitives";
import type { Habit } from "../state/schema";
import { useStore } from "../state/store";

export function HabitEditor({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  const add = () => {
    const label = name.trim();
    if (!label) return;
    tick();
    const base =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .slice(0, 24) || "habit";
    let id = `own_${base}`;
    let n = 2;
    while (state.habits.some((h) => h.id === id)) id = `own_${base}_${n++}`;
    dispatch({ type: "addHabit", habit: { id, name: label } });
    setName("");
  };

  return (
    <>
      <Card>
        <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 14 }}>
          Bonus habits are worth points but do not have to be done for the day to count as complete.
          Retiring one stops tracking it without touching your history.
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {state.habits.map((h: Habit) => (
            <div
              key={h.id}
              style={{ padding: "12px 13px", borderRadius: 14, background: "var(--surface-2)" }}
            >
              <TextInput
                value={h.name}
                aria-label={`Name of ${h.name}`}
                onChange={(e) =>
                  dispatch({ type: "updateHabit", id: h.id, patch: { name: e.target.value } })
                }
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12.5,
                    color: "var(--text-dim)",
                    minHeight: 44,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!h.bonus}
                    onChange={(e) =>
                      dispatch({
                        type: "updateHabit",
                        id: h.id,
                        patch: { bonus: e.target.checked || undefined },
                      })
                    }
                    style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                  />
                  Bonus
                </label>

                {confirming === h.id ? (
                  <span style={{ display: "flex", gap: 6 }}>
                    <Button
                      sm
                      variant="danger"
                      onClick={() => {
                        dispatch({ type: "removeHabit", id: h.id });
                        setConfirming(null);
                      }}
                    >
                      Retire it
                    </Button>
                    <Button sm onClick={() => setConfirming(null)}>
                      Keep
                    </Button>
                  </span>
                ) : (
                  <Button
                    sm
                    onClick={() => setConfirming(h.id)}
                    disabled={state.habits.length <= 1}
                  >
                    Retire
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 16 }}>
          <div style={{ flex: 1 }}>
            <Field label="Add a habit">
              <TextInput
                value={name}
                placeholder="What do you want to do daily?"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
              />
            </Field>
          </div>
          <Button variant="primary" onClick={add} disabled={!name.trim()}>
            Add
          </Button>
        </div>
      </Card>

      <Button block onClick={onClose}>
        Done
      </Button>
    </>
  );
}
