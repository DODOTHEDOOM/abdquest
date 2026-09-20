/**
 * First run.
 *
 * Four short steps, every one of them skippable. The app has to be usable by
 * someone who taps "Skip" on all of it, so nothing here is required: the
 * measurements unlock fitness age, the targets unlock the bars that need them,
 * and leaving either blank simply means those parts stay hidden rather than
 * showing a number invented on your behalf.
 */

import { useState } from "react";
import { tick } from "../design/charts";
import { Button, Card, Field, TextInput } from "../design/primitives";
import { DEFAULT_HABITS, type Habit } from "../state/schema";
import { useStore } from "../state/store";

/** Offered at setup. Someone can keep none of them and write their own. */
const SUGGESTED: Habit[] = [
  ...DEFAULT_HABITS,
  {
    id: "steps",
    name: "Walk 8,000 steps",
    detail: "Anything that keeps you on your feet.",
    icon: "👟",
  },
  {
    id: "stretch",
    name: "Stretch for 10 minutes",
    detail: "Hips, hamstrings, shoulders.",
    icon: "🧘",
  },
  {
    id: "screens",
    name: "No screens after midnight",
    detail: "Phone out of the bedroom.",
    icon: "🌑",
  },
  { id: "plan", name: "Plan tomorrow", detail: "Three things, written down.", icon: "🗒️" },
];

const STEPS = ["Welcome", "About you", "What to track", "Targets"] as const;

function numberOr(raw: string, min: number, max: number): number | undefined {
  const n = Number(raw);
  return raw.trim() && isFinite(n) && n >= min && n <= max ? n : undefined;
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useStore();
  const [step, setStep] = useState(0);

  const [name, setName] = useState(state.profile.name ?? "");
  const [age, setAge] = useState(state.profile.age ? String(state.profile.age) : "");
  const [sex, setSex] = useState<string>(state.profile.sex ?? "");
  const [height, setHeight] = useState(
    state.profile.heightCm ? String(state.profile.heightCm) : "",
  );
  const [weight, setWeight] = useState(
    state.profile.weightKg ? String(state.profile.weightKg) : "",
  );

  const [picked, setPicked] = useState<string[]>(DEFAULT_HABITS.slice(0, 4).map((h) => h.id));
  const [prayers, setPrayers] = useState(state.modules.prayers);
  const [custom, setCustom] = useState("");

  const [water, setWater] = useState(
    state.profile.waterTargetMl ? String(state.profile.waterTargetMl) : "",
  );
  const [kcal, setKcal] = useState(
    state.profile.kcalTarget ? String(state.profile.kcalTarget) : "",
  );
  const [goalWeight, setGoalWeight] = useState(
    state.profile.weightTargetKg ? String(state.profile.weightTargetKg) : "",
  );

  const [extra, setExtra] = useState<Habit[]>([]);

  const finish = () => {
    dispatch({
      type: "setProfile",
      patch: {
        name: name.trim() || undefined,
        age: numberOr(age, 10, 100),
        sex: sex === "male" || sex === "female" || sex === "other" ? sex : undefined,
        heightCm: numberOr(height, 100, 250),
        weightKg: numberOr(weight, 20, 400),
        waterTargetMl: numberOr(water, 250, 10000),
        kcalTarget: numberOr(kcal, 500, 10000),
        weightTargetKg: numberOr(goalWeight, 20, 400),
      },
    });

    const chosen = [...SUGGESTED.filter((h) => picked.includes(h.id)), ...extra];
    // Someone who unticks everything still needs something to tap on day one.
    dispatch({ type: "setHabits", habits: chosen.length ? chosen : DEFAULT_HABITS.slice(0, 3) });
    dispatch({ type: "setModule", key: "prayers", on: prayers });
    dispatch({ type: "completeOnboarding" });
    onDone();
  };

  const next = () => {
    tick();
    if (step === STEPS.length - 1) finish();
    else setStep(step + 1);
  };

  const addCustom = () => {
    const label = custom.trim();
    if (!label) return;
    const id = `own_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${extra.length}`;
    setExtra([...extra, { id, name: label }]);
    setCustom("");
  };

  return (
    <div className="onboard">
      <div className="onboard__bar" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={`onboard__seg${i <= step ? " is-on" : ""}`} />
        ))}
      </div>

      {step === 0 && (
        <>
          <h1 className="onboard__title">Abd&rsquo;s Quest</h1>
          <p className="onboard__lede">
            A habit and health tracker that keeps everything on your phone, works with no signal,
            and never shows you a number it cannot actually justify.
          </p>
          <Card>
            <Field label="What should it call you?" hint="Optional. It is only used to say hello.">
              <TextInput
                value={name}
                autoComplete="given-name"
                placeholder="Your name"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          </Card>
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="onboard__step">About you</h2>
          <p className="onboard__lede">
            These unlock fitness age and make effort accurate, because both depend on your
            heart-rate reserve. Skip and those two simply stay hidden.
          </p>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Age">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </Field>
              <Field label="Sex">
                <select
                  className="field__control"
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Height (cm)">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </Field>
              <Field label="Weight (kg)">
                <TextInput
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </Field>
            </div>
            <p
              style={{ fontSize: 11.5, color: "var(--text-faint)", lineHeight: 1.6, marginTop: 14 }}
            >
              Sex is used only for the published fitness-age norms, which are reported separately
              for men and women. Leave it blank and fitness age is left out.
            </p>
          </Card>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="onboard__step">What do you want to track?</h2>
          <p className="onboard__lede">
            Pick a few to start with. You can add, rename or retire any of them later.
          </p>
          <Card>
            <div style={{ display: "grid", gap: 8 }}>
              {[...SUGGESTED, ...extra].map((h) => {
                const on = picked.includes(h.id) || extra.some((x) => x.id === h.id);
                const isExtra = extra.some((x) => x.id === h.id);
                return (
                  <button
                    key={h.id}
                    className="prayerrow"
                    aria-pressed={on}
                    onClick={() => {
                      tick();
                      if (isExtra) setExtra(extra.filter((x) => x.id !== h.id));
                      else
                        setPicked(
                          picked.includes(h.id)
                            ? picked.filter((x) => x !== h.id)
                            : [...picked, h.id],
                        );
                    }}
                  >
                    <span className="prayerrow__icon" aria-hidden>
                      {h.icon ?? "•"}
                    </span>
                    <span className="prayerrow__body">
                      <span className="prayerrow__name">{h.name}</span>
                      {h.detail && <span className="prayerrow__detail">{h.detail}</span>}
                    </span>
                    <span className={`prayerrow__check${on ? " is-done" : ""}`} aria-hidden>
                      {on ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <div style={{ flex: 1 }}>
                <TextInput
                  value={custom}
                  placeholder="Add your own"
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                />
              </div>
              <Button onClick={addCustom} disabled={!custom.trim()}>
                Add
              </Button>
            </div>
          </Card>

          <Card>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                cursor: "pointer",
              }}
            >
              <span>
                <span style={{ fontSize: 14, fontWeight: 600, display: "block" }}>Prayers</span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-dim)",
                    lineHeight: 1.55,
                    display: "block",
                    marginTop: 2,
                  }}
                >
                  The five daily prayers, times for your location, and a ledger for missed ones.
                </span>
              </span>
              <input
                type="checkbox"
                checked={prayers}
                onChange={(e) => setPrayers(e.target.checked)}
                style={{ width: 20, height: 20, flex: "none", accentColor: "var(--accent)" }}
              />
            </label>
          </Card>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="onboard__step">Any targets?</h2>
          <p className="onboard__lede">
            Leave these blank and no target is shown for them. Nothing is assumed on your behalf.
          </p>
          <Card>
            <div style={{ display: "grid", gap: 12 }}>
              <Field label="Water each day (ml)" hint="Around 2,000 to 3,000 for most adults.">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  step="250"
                  value={water}
                  onChange={(e) => setWater(e.target.value)}
                />
              </Field>
              <Field label="Calories each day">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  step="50"
                  value={kcal}
                  onChange={(e) => setKcal(e.target.value)}
                />
              </Field>
              <Field label="Goal weight (kg)">
                <TextInput
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={goalWeight}
                  onChange={(e) => setGoalWeight(e.target.value)}
                />
              </Field>
            </div>
          </Card>
        </>
      )}

      <div className="onboard__actions">
        <Button variant="primary" block onClick={next}>
          {step === STEPS.length - 1 ? "Start" : "Continue"}
        </Button>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
          {step > 0 ? (
            <button className="onboard__link" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button className="onboard__link" onClick={finish}>
            {step === 0 ? "Skip setup" : "Skip the rest"}
          </button>
        </div>
      </div>
    </div>
  );
}
