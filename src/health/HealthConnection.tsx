/**
 * The Google Health connection panel.
 *
 * Deliberately plain about what it does: your Client ID and Secret are stored
 * on this device only, and disconnecting clears the connection but keeps every
 * reading already synced into the app.
 */

import { useState } from "react";
import { Badge, Button, Card, Field, TextInput } from "../design/primitives";
import { connect, exportCode, importCode, isStandalone, redirectUri } from "./index";
import { useHealthSync } from "./useHealthSync";

function readSaved(key: string): string {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function since(ts: number): string {
  if (!ts) return "never";
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const dim: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-dim)",
  lineHeight: 1.6,
};

export function HealthConnection() {
  const sync = useHealthSync();
  const [cid, setCid] = useState(() => readSaved("abdquest_gh_cid"));
  const [csec, setCsec] = useState(() => readSaved("abdquest_gh_csec"));
  const [showImport, setShowImport] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const [paste, setPaste] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const uri = redirectUri();

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlash(`${what} copied`);
    } catch {
      setFlash("Could not copy — select it by hand");
    }
    setTimeout(() => setFlash(null), 2200);
  };

  return (
    <Card>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Google Health</div>
          <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
            Steps, sleep, resting HR, HRV, VO&#8322;max
          </div>
        </div>
        <Badge tone={sync.connected ? "accent" : "warn"}>
          {sync.connected ? "Connected" : "Not connected"}
        </Badge>
      </div>

      {sync.status && (
        <div style={{ ...dim, marginTop: 12, color: "var(--text)" }}>{sync.status}</div>
      )}

      {sync.connected ? (
        <>
          <div style={{ ...dim, marginTop: 12 }}>
            Last synced {since(sync.lastSync)}. Today and yesterday refresh on their own when you
            open the app.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <Button variant="primary" sm onClick={sync.syncNow} disabled={sync.busy}>
              {sync.busy ? "Syncing…" : "Sync now"}
            </Button>
            <Button sm onClick={() => copy(exportCode() ?? "", "Connection code")}>
              Copy connection code
            </Button>
            <Button sm onClick={() => setShowDiag((v) => !v)}>
              {showDiag ? "Hide details" : "What synced?"}
            </Button>
          </div>

          {showDiag && sync.diag && (
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              {sync.diag.map((day) => (
                <div
                  key={day.date}
                  style={{ padding: 12, borderRadius: 12, background: "var(--surface-2)" }}
                >
                  <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 8 }}>
                    {day.label}
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {Object.entries(day.entries).map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          fontSize: 11.5,
                        }}
                      >
                        <span style={{ color: "var(--text-dim)" }}>{k}</span>
                        <span
                          style={{
                            color: v.startsWith("ok") ? "var(--m-recovery)" : "var(--text-faint)",
                            textAlign: "right",
                            maxWidth: "62%",
                          }}
                        >
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ ...dim, fontSize: 11 }}>
                &ldquo;ok&rdquo; means it came through. Anything else is the reason it did not — a
                403 is a missing permission, and &ldquo;nothing recorded&rdquo; means Google
                genuinely holds no data for that day yet.
              </div>
            </div>
          )}

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <Button sm onClick={sync.forget}>
              Disconnect
            </Button>
            <div style={{ ...dim, marginTop: 8, fontSize: 11.5 }}>
              Disconnecting only forgets the connection. Everything already synced stays in the app.
            </div>
          </div>
        </>
      ) : (
        <>
          {!isStandalone() && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 12,
                background: "var(--surface-2)",
                fontSize: 11.5,
                lineHeight: 1.55,
                color: "var(--text-dim)",
              }}
            >
              You are in a browser tab, not the home-screen app. The two do not share a login —
              connect here, then use <strong>Copy connection code</strong> and paste it into the
              home-screen app.
            </div>
          )}

          <div style={{ ...dim, marginTop: 12 }}>
            One-time setup in Google Cloud Console: enable the <strong>Google Health API</strong>
            and create an <strong>OAuth client (Web application)</strong>.
          </div>

          <div
            style={{
              marginTop: 12,
              padding: "12px 13px",
              borderRadius: 12,
              background: "var(--surface-2)",
              border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)",
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
              This page&rsquo;s redirect URI
            </div>
            <div style={{ ...dim, marginBottom: 8, fontSize: 11.5 }}>
              Paste this into your OAuth client under <strong>Authorized redirect URIs</strong>.
              Google matches it character for character — a different page of the same app is a
              different URI, and a mismatch is the{" "}
              <strong>&ldquo;Access blocked: redirect_uri_mismatch&rdquo;</strong> error.
            </div>
            <div
              style={{
                padding: "9px 11px",
                borderRadius: 10,
                background: "var(--surface)",
                fontSize: 11,
                fontFamily: "ui-monospace, monospace",
                wordBreak: "break-all",
              }}
            >
              {uri}
            </div>
            <Button
              variant="primary"
              sm
              onClick={() => copy(uri, "Redirect URI")}
              style={{ marginTop: 10 }}
            >
              Copy redirect URI
            </Button>
          </div>

          <div style={{ ...dim, marginTop: 12, fontSize: 11.5 }}>
            Sign in with the Google account that holds your health data. If the OAuth consent screen
            is still in <strong>Testing</strong>, that account also has to be listed as a test user,
            and a university or work account may be blocked from third-party apps by its
            administrator.
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <Field label="Client ID">
              <TextInput
                value={cid}
                autoComplete="off"
                spellCheck={false}
                placeholder="...apps.googleusercontent.com"
                onChange={(e) => setCid(e.target.value)}
              />
            </Field>
            <Field
              label="Client Secret"
              hint="Kept on this device only. It goes nowhere except to Google."
            >
              <TextInput
                type="password"
                value={csec}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setCsec(e.target.value)}
              />
            </Field>
          </div>

          <Button
            variant="primary"
            block
            style={{ marginTop: 14 }}
            disabled={!cid.trim() || !csec.trim()}
            onClick={() => connect(cid.trim(), csec.trim())}
          >
            Connect Google Health
          </Button>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <Button sm onClick={() => setShowImport((v) => !v)}>
              {showImport ? "Hide" : "Already connected somewhere else?"}
            </Button>
            {showImport && (
              <div style={{ marginTop: 10 }}>
                <Field label="Paste connection code" hint="From Copy connection code.">
                  <TextInput
                    value={paste}
                    spellCheck={false}
                    onChange={(e) => setPaste(e.target.value)}
                  />
                </Field>
                <Button
                  sm
                  style={{ marginTop: 10 }}
                  disabled={!paste.trim()}
                  onClick={() => {
                    if (importCode(paste.trim())) {
                      setPaste("");
                      sync.refresh();
                      sync.syncNow();
                    } else {
                      setFlash("That code was not readable");
                      setTimeout(() => setFlash(null), 2200);
                    }
                  }}
                >
                  Use this code
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {flash && <div style={{ ...dim, marginTop: 10, color: "var(--m-recovery)" }}>{flash}</div>}
    </Card>
  );
}
