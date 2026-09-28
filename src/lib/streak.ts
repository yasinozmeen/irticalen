import type { Mode } from './types';
import type { StorageLike } from './settings';

/**
 * Daily practice log ("don't break the chain"). Stored only in this browser:
 * `irticalen:days` → `{ "2026-09-28": 3, ... }`, one bitmask per local calendar day.
 * A day counts once a speech timer runs to the end (the `done` phase); closing early never counts.
 */

const KEY = 'irticalen:days';

/** Bit per mode, so a day can record "off-the-cuff only", "research only" or both. */
export const MODE_BIT: Record<Mode, number> = { 'off-the-cuff': 1, 'deep-research': 2 };

export type DayLog = Record<string, number>;

function defaultStorage(): StorageLike | undefined {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return (globalThis as unknown as { localStorage: StorageLike }).localStorage;
    }
  } catch {
    // ignore when inaccessible
  }
  return undefined;
}

/** Local calendar day as `YYYY-MM-DD` (the visitor's own midnight, not UTC). */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The local day before `date` (DST-safe: steps by calendar date, not by 24h). */
function previousDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
}

/** Reads the log; missing/corrupt data or invalid entries are dropped. Never throws. */
export function loadDays(storage: StorageLike | undefined = defaultStorage()): DayLog {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const log: DayLog = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof value === 'number' && value >= 1 && value <= 3) {
        log[key] = value;
      }
    }
    return log;
  } catch {
    return {};
  }
}

/** Marks today as practised in `mode` and returns the updated log. Never throws. */
export function recordPractice(
  mode: Mode,
  now: Date = new Date(),
  storage: StorageLike | undefined = defaultStorage(),
): DayLog {
  const log = loadDays(storage);
  const key = dayKey(now);
  log[key] = (log[key] ?? 0) | MODE_BIT[mode];
  try {
    storage?.setItem(KEY, JSON.stringify(log));
  } catch {
    // ignore when storage is full/blocked
  }
  return log;
}

/**
 * Consecutive practised days ending today — or ending yesterday when today is not done yet,
 * so the chain is not shown as broken before the day is over.
 */
export function currentStreak(log: DayLog, now: Date = new Date()): number {
  let day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!log[dayKey(day)]) day = previousDay(day);
  let count = 0;
  while (log[dayKey(day)]) {
    count += 1;
    day = previousDay(day);
  }
  return count;
}

/** Longest run of consecutive practised days in the whole log. */
export function longestStreak(log: DayLog): number {
  let best = 0;
  let run = 0;
  let expectedNext: string | null = null;
  for (const key of Object.keys(log).sort()) {
    run = key === expectedNext ? run + 1 : 1;
    best = Math.max(best, run);
    const [y, m, d] = key.split('-').map(Number) as [number, number, number];
    expectedNext = dayKey(new Date(y, m - 1, d + 1));
  }
  return best;
}

/** Whether today already counts. */
export function practisedToday(log: DayLog, now: Date = new Date()): boolean {
  return Boolean(log[dayKey(now)]);
}
