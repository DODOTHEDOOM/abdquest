/**
 * Backup: export everything to a file, and read one back in.
 *
 * Three rules, all of them about not losing data.
 *
 * 1. Old backups must still import. The previous app exported a bare v2 state
 *    object, so a file saved from it is recognised and migrated. A v3 file and
 *    the wrapped format below are recognised too.
 * 2. Nothing is replaced before the incoming file has been validated. A corrupt
 *    or unrelated JSON file is rejected with a reason, never loaded.
 * 3. Importing writes the current state to a rescue slot first, so a restore
 *    that turns out to be the wrong file can still be undone.
 */

import { looksLikeV2, migrateV2 } from "../state/migrate";
import { emptyState, STORAGE_KEY, type AppState } from "../state/schema";

/** Where the state is copied immediately before an import overwrites it. */
export const RESCUE_KEY = "abdquest_v3_rescue";
/** A rolling copy of the last good save, as a second line of defence. */
export const BACKUP_KEY = "abdquest_v3_backup";

export const BACKUP_FORMAT = 1;

export interface BackupFile {
  app: "abdquest";
  format: number;
  exportedAt: string;
  state: AppState;
}

export function buildBackup(state: AppState, now = new Date()): BackupFile {
  return {
    app: "abdquest",
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    state,
  };
}

export function backupFilename(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const d = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  return `abdquest_backup_${d}.json`;
}

export function serialiseBackup(state: AppState, now = new Date()): string {
  return JSON.stringify(buildBackup(state, now), null, 2);
}

export type BackupSource = "v3-file" | "v3-bare" | "v2-bare";

/**
 * One flat shape rather than a discriminated union: this project compiles with
 * `strict: false`, under which TypeScript will not narrow a `true | false`
 * discriminant, so a union here would force every caller to cast.
 */
export interface ImportResult {
  ok: boolean;
  /** The state to load. Null when `ok` is false. */
  state: AppState | null;
  source: BackupSource | null;
  /** Things worth telling the user, e.g. that an old backup was converted. */
  notes: string[];
  /** Why it was refused. Null when `ok` is true. */
  error: string | null;
}

function accepted(state: AppState, source: BackupSource, notes: string[] = []): ImportResult {
  return { ok: true, state, source, notes, error: null };
}

function refused(error: string): ImportResult {
  return { ok: false, state: null, source: null, notes: [], error };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * A v3 state that has been through a file round trip. Missing keys are filled
 * from a fresh state rather than trusted, so a hand-edited or truncated file
 * cannot produce a state the app then crashes on.
 */
function reviveV3(raw: Record<string, unknown>): AppState {
  const base = emptyState();
  const s = { ...base, ...raw } as AppState;
  // Containers must exist and be the right shape whatever the file said.
  if (!Array.isArray(s.habits) || !s.habits.length) s.habits = base.habits;
  if (!Array.isArray(s.sessions)) s.sessions = [];
  if (!Array.isArray(s.weight)) s.weight = [];
  if (!Array.isArray(s.calories)) s.calories = [];
  if (!Array.isArray(s.water)) s.water = [];
  if (!isObject(s.done)) s.done = {};
  if (!isObject(s.health)) s.health = {};
  if (!isObject(s.notes)) s.notes = {};
  if (!isObject(s.profile)) s.profile = base.profile;
  if (!isObject(s.modules)) s.modules = base.modules;
  if (!isObject(s.prayers) || !isObject(s.prayers.done) || !isObject(s.prayers.debt)) {
    s.prayers = base.prayers;
  }
  if (!isObject(s.streak)) s.streak = base.streak;
  if (typeof s.xp !== "number" || !isFinite(s.xp) || s.xp < 0) s.xp = 0;
  s.version = 3;
  return s;
}

/** Reads a backup file's text. Never throws; a bad file comes back as a reason. */
export function parseBackup(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return refused("That file is not valid JSON, so nothing was changed.");
  }

  if (!isObject(parsed)) {
    return refused("That file does not contain a backup, so nothing was changed.");
  }

  // The wrapped format this app writes.
  if (parsed.app === "abdquest" && isObject(parsed.state)) {
    const notes: string[] = [];
    if (typeof parsed.format === "number" && parsed.format > BACKUP_FORMAT) {
      notes.push(
        "This backup came from a newer version of the app. Anything it did not recognise was left out.",
      );
    }
    return accepted(reviveV3(parsed.state), "v3-file", notes);
  }

  // A bare v3 state.
  if (parsed.version === 3) {
    return accepted(reviveV3(parsed), "v3-bare");
  }

  // A backup saved from the old app, which wrote the bare v2 object.
  if (looksLikeV2(parsed)) {
    return accepted(migrateV2(parsed), "v2-bare", [
      "This backup came from the old app and was converted across.",
    ]);
  }

  return refused("That file is JSON, but it is not an Abd's Quest backup. Nothing was changed.");
}

// ── Rescue slots ────────────────────────────────────────────────────────────

function write(key: string, state: AppState): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function read(key: string): AppState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isObject(parsed) && parsed.version === 3 ? reviveV3(parsed) : null;
  } catch {
    return null;
  }
}

/** Copies the current state aside. Called immediately before an import lands. */
export function saveRescuePoint(state: AppState): boolean {
  return write(RESCUE_KEY, state);
}

export function readRescuePoint(): AppState | null {
  return read(RESCUE_KEY);
}

export function hasRescuePoint(): boolean {
  try {
    return !!localStorage.getItem(RESCUE_KEY);
  } catch {
    return false;
  }
}

/** The rolling second copy, kept in step with normal saves. */
export function saveRollingBackup(state: AppState): boolean {
  return write(BACKUP_KEY, state);
}

export function readRollingBackup(): AppState | null {
  return read(BACKUP_KEY);
}

/**
 * What is actually in storage, for the "your data" panel. Reported in bytes so
 * a device running out of room is visible before a save starts failing.
 */
export interface StorageReport {
  keys: { key: string; bytes: number }[];
  totalBytes: number;
}

export function storageReport(): StorageReport {
  const keys: { key: string; bytes: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("abdquest")) continue;
      keys.push({ key, bytes: (localStorage.getItem(key) ?? "").length });
    }
  } catch {
    return { keys: [], totalBytes: 0 };
  }
  keys.sort((a, b) => b.bytes - a.bytes);
  return { keys, totalBytes: keys.reduce((a, b) => a + b.bytes, 0) };
}

/** True when the main slot holds something, used to warn before a reset. */
export function hasStoredState(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}
