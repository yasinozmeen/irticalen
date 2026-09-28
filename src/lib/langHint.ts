import type { StorageLike } from './settings';
import type { Locale } from './types';

const KEY_LANG_HINT = 'irticalen:langHint';

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

/** True if any of the given tags (e.g. `navigator.languages`) is primarily Turkish ("tr", "tr-TR", …). Pure. */
export function prefersTurkish(languages: readonly string[]): boolean {
  return languages.some((lang) => lang.toLowerCase().split('-')[0] === 'tr');
}

/**
 * Whether to show the one-time "other language" hint in the dock: on the Turkish page when the
 * browser does not prefer Turkish, on the English page when it does — the two are deliberately not
 * mirror images of each other (a non-Turkish browser on the English page is the expected case and
 * gets no hint). Once shown (`seen`), never again. Pure.
 */
export function shouldShowLangHint(locale: Locale, languages: readonly string[], seen: boolean): boolean {
  if (seen) return false;
  const trPreferred = prefersTurkish(languages);
  return locale === 'tr' ? !trPreferred : trPreferred;
}

/** Reads whether the hint has already been shown once; missing/corrupt storage counts as not shown. Never throws. */
export function loadLangHintSeen(storage: StorageLike | undefined = defaultStorage()): boolean {
  try {
    return storage?.getItem(KEY_LANG_HINT) === 'seen';
  } catch {
    return false;
  }
}

/** Marks the hint as shown, so it never appears again in this browser. Never throws. */
export function saveLangHintSeen(storage: StorageLike | undefined = defaultStorage()): void {
  try {
    storage?.setItem(KEY_LANG_HINT, 'seen');
  } catch {
    // ignore when storage is full/blocked
  }
}
