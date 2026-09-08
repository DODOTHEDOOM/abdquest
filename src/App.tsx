import { getLvl, getNextLvl } from "./lib/levels";
import { ymd } from "./lib/dates";

/**
 * Phase 0 placeholder.
 *
 * The real UI is still `legacy/AbdQuest.html` (unchanged, still the deployed app).
 * This shell exists to stand up the Vite + TypeScript + Vitest toolchain and to
 * prove the extracted `src/lib/*` logic is importable. Screens get ported into
 * here one at a time in Phase 3.
 */
export function App() {
  const demoXp = 1234;
  const lvl = getLvl(demoXp);
  const next = getNextLvl(demoXp);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#08080c",
        color: "#ece3d0",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        textAlign: "center",
        padding: 24,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#ffd479" }}>Abd&rsquo;s Quest</div>
        <div style={{ fontSize: 13, color: "#857a63", marginTop: 6 }}>
          Modernization shell &mdash; {ymd(new Date())}
        </div>
        <div style={{ fontSize: 13, marginTop: 16 }}>
          lib check: {demoXp} XP &rarr; L{lvl.level} {lvl.name} &middot; next {next.name} at{" "}
          {next.minXp}
        </div>
      </div>
    </div>
  );
}
