/**
 * Your data: take a backup, restore one, and see what is stored.
 *
 * The restore flow is deliberately slow. It shows you what is in the file
 * before anything is replaced, keeps a rescue copy of what you had, and offers
 * to undo afterwards. Restoring the wrong file should be an inconvenience, not
 * a catastrophe.
 */

import { useMemo, useRef, useState } from "react";
import { Button, Card, SectionHeader } from "../design/primitives";
import {
  backupFilename,
  hasRescuePoint,
  parseBackup,
  readRescuePoint,
  saveRescuePoint,
  serialiseBackup,
  storageReport,
  type ImportResult,
} from "../lib/backup";
import { LEGACY_KEY, type AppState } from "../state/schema";
import { useStore } from "../state/store";

const dim: React.CSSProperties = { fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 };

function countsIn(state: AppState) {
  return [
    { label: "Habits", n: state.habits.length },
    { label: "Days logged", n: Object.keys(state.done).length },
    { label: "Training sessions", n: state.sessions.length },
    { label: "Health days", n: Object.keys(state.health).length },
    { label: "Weigh-ins", n: state.weight.length },
    { label: "Journal entries", n: Object.keys(state.notes).length },
  ];
}

function kb(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function DataPanel() {
  const { state, dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ImportResult | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [undoable, setUndoable] = useState(hasRescuePoint);
  const [showStorage, setShowStorage] = useState(false);

  const report = useMemo(() => (showStorage ? storageReport() : null), [showStorage, flash]);
  const legacyPresent = useMemo(() => {
    try {
      return !!localStorage.getItem(LEGACY_KEY);
    } catch {
      return false;
    }
  }, []);

  const say = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  };

  const exportNow = () => {
    try {
      const text = serialiseBackup(state);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backupFilename();
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking immediately can cancel the download on some mobile browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      say("Backup saved to your downloads");
    } catch (e) {
      say(`Could not save the backup: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => say("That file could not be read");
    reader.onload = () => setPending(parseBackup(String(reader.result ?? "")));
    reader.readAsText(file);
  };

  const confirmRestore = () => {
    if (!pending?.ok || !pending.state) return;
    // The rescue copy is written BEFORE anything is replaced.
    saveRescuePoint(state);
    dispatch({ type: "replace", state: pending.state });
    setUndoable(true);
    setPending(null);
    say("Restored. You can undo this below.");
  };

  const undoRestore = () => {
    const previous = readRescuePoint();
    if (!previous) return say("There is nothing to go back to");
    dispatch({ type: "replace", state: previous });
    say("Put back the way it was");
  };

  return (
    <>
      <SectionHeader title="Your data" />
      <Card>
        <div style={dim}>
          Everything lives on this device only. Nothing is uploaded, and nobody else can see it.
          That also means a lost phone is a lost history, so keep a backup somewhere safe.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            margin: "16px 0",
          }}
        >
          {countsIn(state).map((c) => (
            <div
              key={c.label}
              style={{ padding: "10px 12px", borderRadius: 12, background: "var(--surface-2)" }}
            >
              <div style={{ fontSize: 19, fontWeight: 700 }}>{c.n}</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{c.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="primary" onClick={exportNow}>
            Save a backup
          </Button>
          <Button onClick={() => fileRef.current?.click()}>Restore from a file</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              chooseFile(e.target.files?.[0]);
              // Allow picking the same file twice in a row.
              e.target.value = "";
            }}
          />
        </div>

        {undoable && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <Button onClick={undoRestore}>Undo the last restore</Button>
            <div style={{ ...dim, fontSize: 11.5, marginTop: 8 }}>
              Puts back whatever was here immediately before your most recent restore.
            </div>
          </div>
        )}

        {flash && <div style={{ ...dim, marginTop: 12, color: "var(--m-recovery)" }}>{flash}</div>}
      </Card>

      {/* ── What is in the file, before anything is replaced ─────────────── */}
      {pending && (
        <Card>
          {pending.ok && pending.state ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Restore this backup?</div>
              <div style={{ ...dim, marginTop: 6 }}>
                This replaces everything currently in the app. A copy of what you have now is kept
                first, so you can undo it.
              </div>
              {pending.notes.map((n) => (
                <div key={n} style={{ ...dim, marginTop: 8, color: "var(--text)" }}>
                  {n}
                </div>
              ))}
              <div style={{ display: "grid", gap: 6, margin: "14px 0" }}>
                {countsIn(pending.state).map((c) => {
                  const now = countsIn(state).find((x) => x.label === c.label)?.n ?? 0;
                  return (
                    <div
                      key={c.label}
                      style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}
                    >
                      <span style={{ color: "var(--text-dim)" }}>{c.label}</span>
                      <span>
                        {now} <span style={{ color: "var(--text-faint)" }}>to</span>{" "}
                        <strong>{c.n}</strong>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="primary" onClick={confirmRestore}>
                  Replace my data
                </Button>
                <Button onClick={() => setPending(null)}>Cancel</Button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 700 }}>That file was not used</div>
              <div style={{ ...dim, marginTop: 6 }}>{pending.error}</div>
              <Button style={{ marginTop: 12 }} onClick={() => setPending(null)}>
                Close
              </Button>
            </>
          )}
        </Card>
      )}

      {/* ── Storage ─────────────────────────────────────────────────────── */}
      <Card>
        <Button onClick={() => setShowStorage((v) => !v)}>
          {showStorage ? "Hide what is stored" : "Show what is stored"}
        </Button>
        {report && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              {report.keys.map((k) => (
                <div
                  key={k.key}
                  style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}
                >
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{k.key}</span>
                  <span style={{ color: "var(--text-dim)" }}>{kb(k.bytes)}</span>
                </div>
              ))}
            </div>
            <div style={{ ...dim, marginTop: 10, fontSize: 11.5 }}>
              {kb(report.totalBytes)} in total. Browsers usually allow about 5 MB.
            </div>
          </div>
        )}
        {legacyPresent && (
          <div style={{ ...dim, marginTop: 12, fontSize: 11.5 }}>
            Your original data from the old app is still on this device untouched, under
            <span style={{ fontFamily: "ui-monospace, monospace" }}> abdquest_v2</span>. This app
            only ever reads it. Nothing here will delete it.
          </div>
        )}
      </Card>
    </>
  );
}
