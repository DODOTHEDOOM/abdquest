/**
 * Drives the Google Health connection from React.
 *
 * Mirrors what the old app did on open: finish an OAuth redirect if there is
 * one, otherwise sync quietly when the last sync is over ten minutes old. Sync
 * results are merged into the store, never written over it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../state/store";
import {
  disconnect as ghDisconnect,
  ensureToken,
  fetchDay,
  handleRedirect,
  isConnected,
  primeCatalog,
  sessionsFromDay,
  toDailyHealth,
  type RawDay,
} from "./index";

/** Same key the old app used, so a recent sync there counts here too. */
const LAST_KEY = "abdquest_fb_last";
const QUIET_SYNC_AFTER_MS = 10 * 60 * 1000;

function readLast(): number {
  try {
    return parseInt(localStorage.getItem(LAST_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

function writeLast(): void {
  try {
    localStorage.setItem(LAST_KEY, String(Date.now()));
  } catch {
    /* a full disk must not break the sync */
  }
}

function dayKey(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface HealthSync {
  connected: boolean;
  busy: boolean;
  lastSync: number;
  /** Human-readable result of the last attempt. */
  status: string | null;
  /** Per-metric notes from the last sync, for the diagnostics panel. */
  diag: Record<string, string> | null;
  syncNow: () => void;
  forget: () => void;
  refresh: () => void;
}

export function useHealthSync(): HealthSync {
  const { dispatch } = useStore();
  const [connected, setConnected] = useState(isConnected);
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState(readLast);
  const [status, setStatus] = useState<string | null>(null);
  const [diag, setDiag] = useState<Record<string, string> | null>(null);
  const running = useRef(false);

  const apply = useCallback(
    (date: string, raw: RawDay | null) => {
      if (!raw) return false;
      const day = toDailyHealth(date, raw);
      const sessions = sessionsFromDay(date, raw);
      const mins = sessions.reduce((a, s) => a + (s.kind === "gym" ? 0 : s.minutes), 0);
      if (mins > 0) day.workoutMins = mins;
      dispatch({ type: "mergeHealth", date, day });
      if (raw.exercises) dispatch({ type: "syncAutoSessions", date, sessions });
      return true;
    },
    [dispatch],
  );

  const run = useCallback(
    async (manual: boolean) => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      if (manual) setStatus("Syncing…");
      try {
        // Check the sign-in first, so an expired token is never reported as
        // "no data". They need completely different things from you.
        if (isConnected() && !(await ensureToken())) {
          setStatus(
            "Your Google sign-in has expired. Reconnect below — while the consent screen is in Testing, Google ends the session every 7 days.",
          );
          setConnected(false);
          return;
        }
        primeCatalog();
        const today = dayKey(0);
        const yesterday = dayKey(-1);
        // Yesterday first (cheap), then today with the full hourly detail —
        // the same order and depth the old app used.
        const ry = await fetchDay(yesterday, false);
        const rt = await fetchDay(today, true);
        const okY = apply(yesterday, ry);
        const okT = apply(today, rt);
        setDiag(rt?.diag ?? ry?.diag ?? null);

        if (!okY && !okT) {
          setStatus(
            isConnected()
              ? "Nothing came back. Your watch may not have synced to Google yet."
              : "Sync failed — reconnect below.",
          );
          setConnected(isConnected());
          return;
        }
        writeLast();
        setLastSync(Date.now());
        const bits: string[] = [];
        if (rt?.steps) bits.push(`${rt.steps.toLocaleString()} steps`);
        if (rt?.sleepHrs) bits.push(`${rt.sleepHrs.toFixed(1)}h sleep`);
        if (rt?.rhr) bits.push(`${rt.rhr} bpm resting`);
        setStatus(bits.length ? `Synced — ${bits.join(", ")}` : "Synced");
      } catch (e) {
        setStatus(`Sync error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [apply],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await handleRedirect();
      if (cancelled) return;
      if (r.handled) {
        setConnected(true);
        setStatus("Connected ✓");
        void run(false);
        return;
      }
      if (r.error) {
        setStatus(r.error);
        return;
      }
      if (isConnected() && Date.now() - readLast() > QUIET_SYNC_AFTER_MS) void run(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [run]);

  return {
    connected,
    busy,
    lastSync,
    status,
    diag,
    syncNow: () => void run(true),
    forget: () => {
      ghDisconnect();
      setConnected(false);
      setStatus("Disconnected. Your synced data stays in the app.");
    },
    refresh: () => setConnected(isConnected()),
  };
}
