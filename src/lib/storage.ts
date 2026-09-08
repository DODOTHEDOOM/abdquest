// localStorage persistence, extracted verbatim from legacy/AbdQuest.html.
//
// NOTE (addressed in Phase 1): `savMain`/`savBak` currently swallow every error,
// including QuotaExceededError, so a full localStorage silently loses data. Phase 1
// adds an onError hook + UI warning. For now the behaviour is preserved exactly.

import type { GameState } from "./scoring";

export const MAIN_KEY = "abdquest_v2";
export const BAK_KEY = "abdquest_v2_backup";

const REQUIRED_KEYS = ["xp", "streak", "done", "habits", "prayers"] as const;

/** True if `s` looks like a valid persisted state blob. */
export function vState(s: unknown): s is GameState {
  return (
    !!s && typeof s === "object" && REQUIRED_KEYS.every((k) => k in (s as Record<string, unknown>))
  );
}

export function savMain(s: GameState): void {
  try {
    localStorage.setItem(MAIN_KEY, JSON.stringify(s));
  } catch {
    /* swallowed — see Phase 1 note above */
  }
}

export function savBak(s: GameState): void {
  try {
    localStorage.setItem(BAK_KEY, JSON.stringify(s));
  } catch {
    /* swallowed — see Phase 1 note above */
  }
}

/** Load main state, falling back to the backup slot, then null. */
export function loadSafe(): GameState | null {
  try {
    const r = localStorage.getItem(MAIN_KEY);
    if (r) {
      const p = JSON.parse(r);
      if (vState(p)) return p;
    }
  } catch {
    /* ignore */
  }
  try {
    const r2 = localStorage.getItem(BAK_KEY);
    if (r2) {
      const p2 = JSON.parse(r2);
      if (vState(p2)) return p2;
    }
  } catch {
    /* ignore */
  }
  return null;
}
