import { Badge, Button, Card, Field, SectionHeader, TextInput } from "../design/primitives";
import { DEMO_PROFILE } from "../lib/demoData";

export function You({
  theme,
  onTheme,
}: {
  theme: "light" | "dark";
  onTheme: (t: "light" | "dark") => void;
}) {
  return (
    <>
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
              <TextInput type="number" defaultValue={DEMO_PROFILE.age} inputMode="numeric" />
            </Field>
            <Field label="Sex">
              <TextInput defaultValue={DEMO_PROFILE.sex} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Height (cm)">
              <TextInput type="number" defaultValue={DEMO_PROFILE.heightCm} inputMode="numeric" />
            </Field>
            <Field label="Weight (kg)">
              <TextInput type="number" defaultValue={DEMO_PROFILE.weightKg} inputMode="numeric" />
            </Field>
          </div>
          <Field
            label="Sleep need (hours)"
            hint="Your personal baseline — most adults sit between 7 and 9."
          >
            <TextInput type="number" step="0.5" defaultValue={DEMO_PROFILE.sleepNeedHrs} />
          </Field>
        </div>
      </Card>

      <SectionHeader title="Appearance" />
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Theme</div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
              Currently {theme}
            </div>
          </div>
          <Button variant="ghost" sm onClick={() => onTheme(theme === "light" ? "dark" : "light")}>
            Switch to {theme === "light" ? "dark" : "light"}
          </Button>
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
