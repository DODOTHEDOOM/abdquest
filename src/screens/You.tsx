import { Badge, Card, Field, SectionHeader, TextInput } from "../design/primitives";
import { ThemePicker } from "../design/ThemePicker";
import type { Theme } from "../design/themes";
import { useStore } from "../state/store";

export function You({
  themeId,
  level,
  onPickTheme,
}: {
  themeId: string;
  level: number;
  onPickTheme: (t: Theme, locked: boolean) => void;
}) {
  const { state, dispatch } = useStore();
  const profile = state.profile;

  return (
    <>
      <SectionHeader title="Colourways" />
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-dim)",
          lineHeight: 1.55,
          margin: "-4px 0 14px",
        }}
      >
        You&rsquo;re Level {level}. New palettes unlock as you level up — tap a locked one to
        preview it.
      </div>
      <ThemePicker value={themeId} level={level} onChange={onPickTheme} />

      <SectionHeader title="Profile" />
      <Card>
        <div
          style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 16 }}
        >
          Fitness age and effort need these to be accurate — they feed the VO₂max and
          heart-rate-reserve maths.
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Age">
              <TextInput
                type="number"
                inputMode="numeric"
                value={profile.age ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "setProfile",
                    patch: { age: Number(e.target.value) || undefined },
                  })
                }
              />
            </Field>
            <Field label="Sex">
              <TextInput
                placeholder="male / female"
                value={profile.sex ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "setProfile",
                    patch: { sex: e.target.value as "male" | "female" | "other" },
                  })
                }
              />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Height (cm)">
              <TextInput
                type="number"
                inputMode="numeric"
                value={profile.heightCm ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "setProfile",
                    patch: { heightCm: Number(e.target.value) || undefined },
                  })
                }
              />
            </Field>
            <Field label="Weight (kg)">
              <TextInput
                type="number"
                inputMode="numeric"
                value={profile.weightKg ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "setProfile",
                    patch: { weightKg: Number(e.target.value) || undefined },
                  })
                }
              />
            </Field>
          </div>
          <Field
            label="Sleep need (hours)"
            hint="Your personal baseline — most adults sit between 7 and 9."
          >
            <TextInput
              type="number"
              step="0.5"
              value={profile.sleepNeedHrs ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "setProfile",
                  patch: { sleepNeedHrs: Number(e.target.value) || undefined },
                })
              }
            />
          </Field>
        </div>
      </Card>

      <SectionHeader title="Connections" />
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Google Health</div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
              Steps, sleep, heart rate, VO₂max
            </div>
          </div>
          <Badge tone="warn">Not wired up yet</Badge>
        </div>
      </Card>

      <SectionHeader title="About" />
      <Card>
        <p style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.65, margin: 0 }}>
          This is a preview of the rebuilt app. The numbers you see are sample data running through
          the real metrics engine — recovery, effort, sleep and fitness age are all computed with
          published methods, and each has a &ldquo;how it&rsquo;s measured&rdquo; explanation.
          Nothing here is medical advice.
        </p>
      </Card>
    </>
  );
}
