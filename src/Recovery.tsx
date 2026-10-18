/**
 * The screen you see instead of a blank page if the app crashes.
 *
 * This matters more than usual because the app is about to take over the
 * address the Home Screen icon opens. If something in a real, years-old data
 * set trips a bug, the alternative to this screen is a white page with no way
 * out, sitting on top of the only copy of that data.
 *
 * Nothing here touches the store or React state, because those may be exactly
 * what broke. The backup reads localStorage directly, and the classic app link
 * goes to the old app, which reads the old data that this app never writes to.
 */

import { Component, type ReactNode } from "react";
import { EDITION } from "./edition";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Every key this app or the old one ever wrote, read raw. */
function rawDump(): string {
  const out: Record<string, unknown> = {
    app: "abdquest",
    kind: "emergency-dump",
    takenAt: new Date().toISOString(),
    keys: {} as Record<string, unknown>,
  };
  const keys = out.keys as Record<string, unknown>;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("abdquest")) continue;
      // Credentials stay out of a file that may get emailed around.
      if (k === "abdquest_gh" || k === "abdquest_gh_csec" || k === "abdquest_gh_cid") continue;
      const raw = localStorage.getItem(k);
      try {
        keys[k] = raw ? JSON.parse(raw) : raw;
      } catch {
        keys[k] = raw;
      }
    }
  } catch {
    /* storage unreadable; the file will say so by being empty */
  }
  return JSON.stringify(out, null, 2);
}

function classicHref(): string {
  // From /abdquest/AbdQuest.html the classic app is a sibling; from a
  // directory install like /abdquest/app/ it is one level up.
  return location.pathname.endsWith("/") ? "../classic.html" : "./classic.html";
}

export class Recovery extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Kept for anyone looking at the console on a connected device.
    console.error("App crashed:", error);
  }

  private saveDump = () => {
    try {
      const blob = new Blob([rawDump()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `abdquest_emergency_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      /* nothing sensible left to try */
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const box: React.CSSProperties = {
      maxWidth: 520,
      margin: "0 auto",
      padding: "max(32px, env(safe-area-inset-top)) 20px 40px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#14181e",
      lineHeight: 1.6,
    };
    const btn: React.CSSProperties = {
      display: "block",
      width: "100%",
      minHeight: 48,
      marginTop: 10,
      borderRadius: 12,
      border: "1px solid #d4dae1",
      background: "#fff",
      color: "#14181e",
      font: "inherit",
      fontWeight: 600,
      fontSize: 15,
      cursor: "pointer",
      textAlign: "center",
      textDecoration: "none",
      lineHeight: "46px",
    };

    return (
      <div style={{ minHeight: "100dvh", background: "#f5f7f9" }}>
        <div style={box}>
          <h1 style={{ fontSize: 24, margin: "0 0 10px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Your data is safe.</strong> Nothing has been deleted. The app hit an error while
            drawing the screen, and stopped rather than guess.
          </p>
          <p style={{ margin: "0 0 18px", color: "#5b6573", fontSize: 14 }}>
            Save a copy first, then try again. If it keeps happening, the classic app still works
            and still has everything up to the day you switched.
          </p>

          <button style={{ ...btn, background: "#14181e", color: "#fff" }} onClick={this.saveDump}>
            Save a copy of my data
          </button>
          <button style={btn} onClick={() => location.reload()}>
            Try again
          </button>
          {EDITION.migrateLegacy && (
            <a style={btn} href={classicHref()}>
              Open the classic app
            </a>
          )}

          <details style={{ marginTop: 22, fontSize: 12, color: "#5b6573" }}>
            <summary style={{ cursor: "pointer" }}>Error details</summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#fff",
                border: "1px solid #e1e6eb",
                borderRadius: 8,
                padding: 10,
                marginTop: 8,
              }}
            >
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
