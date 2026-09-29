import type { Locale, Settings } from './types';
import { normalizeRecordFormat, normalizeRecordMode } from './recorder';
import { normalizeAspect, normalizeStyleId, resolveAspectForStyle, getStyle } from './compositor/styles';

/** Minute bounds. */
export const SPEECH_MIN = 1;
export const SPEECH_MAX = 10;
export const RESEARCH_MIN = 1;
export const RESEARCH_MAX = 60;

/** Default durations (seconds). */
export const DEFAULT_SPEECH_SEC = 60;
export const DEFAULT_RESEARCH_SEC = 600;

const KEY_SPEECH = 'irticalen:speech';
const KEY_RESEARCH = 'irticalen:research';
const KEY_MUTED = 'irticalen:muted';
const KEY_LANG = 'irticalen:lang';
const KEY_HIDE_CLOCK = 'irticalen:hideClock';
const KEY_RECORD = 'irticalen:record';
const KEY_RECORD_FORMAT = 'irticalen:recordFormat';
const KEY_RECORD_STYLE = 'irticalen:recordStyle';
const KEY_RECORD_ASPECT = 'irticalen:recordAspect';

/** Minimal storage interface (localStorage-compatible, injectable). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Safely returns globalThis.localStorage when nothing was injected (undefined during SSR). */
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

/** Rounds and clamps a minute value by kind; NaN/malformed values fall back to the default. */
export function clampMinutes(kind: 'speech' | 'research', minutes: number): number {
  const min = kind === 'speech' ? SPEECH_MIN : RESEARCH_MIN;
  const max = kind === 'speech' ? SPEECH_MAX : RESEARCH_MAX;
  const fallback = kind === 'speech' ? DEFAULT_SPEECH_SEC / 60 : DEFAULT_RESEARCH_SEC / 60;
  if (!Number.isFinite(minutes)) return fallback;
  const rounded = Math.round(minutes);
  return Math.min(max, Math.max(min, rounded));
}

function readSeconds(
  storage: StorageLike | undefined,
  key: string,
  kind: 'speech' | 'research',
  fallbackSec: number,
): number {
  try {
    if (!storage) return fallbackSec;
    const raw = storage.getItem(key);
    if (raw === null || raw === '') return fallbackSec;
    const parsedSec = Number(raw);
    if (!Number.isFinite(parsedSec)) return fallbackSec;
    const minutes = parsedSec / 60;
    return clampMinutes(kind, minutes) * 60;
  } catch {
    return fallbackSec;
  }
}

/** Reads saved settings; falls back to defaults if storage is missing/corrupt. Never throws. */
export function loadSettings(storage: StorageLike | undefined = defaultStorage()): Settings {
  const speechSec = readSeconds(storage, KEY_SPEECH, 'speech', DEFAULT_SPEECH_SEC);
  const researchSec = readSeconds(storage, KEY_RESEARCH, 'research', DEFAULT_RESEARCH_SEC);
  let muted = false;
  try {
    muted = storage?.getItem(KEY_MUTED) === 'true';
  } catch {
    muted = false;
  }
  let hideClock = false;
  try {
    hideClock = storage?.getItem(KEY_HIDE_CLOCK) === 'true';
  } catch {
    hideClock = false;
  }
  let record: Settings['record'] = 'camera';
  try {
    record = normalizeRecordMode(storage?.getItem(KEY_RECORD));
  } catch {
    record = 'camera';
  }
  let recordFormat: Settings['recordFormat'] = 'template';
  try {
    recordFormat = normalizeRecordFormat(storage?.getItem(KEY_RECORD_FORMAT));
  } catch {
    recordFormat = 'template';
  }
  let recordStyle: Settings['recordStyle'] = normalizeStyleId(undefined);
  try {
    recordStyle = normalizeStyleId(storage?.getItem(KEY_RECORD_STYLE));
  } catch {
    recordStyle = normalizeStyleId(undefined);
  }
  let recordAspect: Settings['recordAspect'] = 'wide';
  try {
    recordAspect = resolveAspectForStyle(getStyle(recordStyle), normalizeAspect(storage?.getItem(KEY_RECORD_ASPECT)));
  } catch {
    recordAspect = 'wide';
  }
  return { speechSec, researchSec, muted, hideClock, record, recordFormat, recordStyle, recordAspect };
}

/** Whether the visitor ever picked a recording aspect — a phone without one defaults to 'tall'. */
export function hasSavedRecordAspect(storage: StorageLike | undefined = defaultStorage()): boolean {
  try {
    return Boolean(storage?.getItem(KEY_RECORD_ASPECT));
  } catch {
    return false;
  }
}

/** Saves settings partially (fields not provided are left untouched). Never throws. */
export function saveSettings(
  partial: Partial<Settings>,
  storage: StorageLike | undefined = defaultStorage(),
): void {
  if (!storage) return;
  try {
    if (partial.speechSec !== undefined) {
      storage.setItem(KEY_SPEECH, String(clampMinutes('speech', partial.speechSec / 60) * 60));
    }
    if (partial.researchSec !== undefined) {
      storage.setItem(
        KEY_RESEARCH,
        String(clampMinutes('research', partial.researchSec / 60) * 60),
      );
    }
    if (partial.muted !== undefined) {
      storage.setItem(KEY_MUTED, partial.muted ? 'true' : 'false');
    }
    if (partial.hideClock !== undefined) {
      storage.setItem(KEY_HIDE_CLOCK, partial.hideClock ? 'true' : 'false');
    }
    if (partial.record !== undefined) {
      storage.setItem(KEY_RECORD, normalizeRecordMode(partial.record));
    }
    if (partial.recordFormat !== undefined) {
      storage.setItem(KEY_RECORD_FORMAT, normalizeRecordFormat(partial.recordFormat));
    }
    if (partial.recordStyle !== undefined) {
      storage.setItem(KEY_RECORD_STYLE, normalizeStyleId(partial.recordStyle));
    }
    if (partial.recordAspect !== undefined) {
      storage.setItem(KEY_RECORD_ASPECT, normalizeAspect(partial.recordAspect));
    }
  } catch {
    // sessizce yok say
  }
}

/** Reads the saved locale; returns 'tr' if missing/corrupt. */
export function loadLocale(storage: StorageLike | undefined = defaultStorage()): Locale {
  try {
    const raw = storage?.getItem(KEY_LANG);
    if (raw === 'tr' || raw === 'en') return raw;
  } catch {
    // yok say
  }
  return 'tr';
}

/** Saves the locale. Never throws. */
export function saveLocale(locale: Locale, storage: StorageLike | undefined = defaultStorage()): void {
  try {
    storage?.setItem(KEY_LANG, locale);
  } catch {
    // yok say
  }
}
