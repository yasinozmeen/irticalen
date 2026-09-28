import type { StorageLike } from './settings';

/** Desktop "rich" view (open-book layout) vs the default minimalist page. */
export type ViewMode = 'minimal' | 'rich';

export const DEFAULT_VIEW: ViewMode = 'minimal';

/** Below this viewport width the rich view is never offered nor applied — the page is always minimalist. */
export const RICH_VIEW_MIN_WIDTH = 1100;

const KEY_VIEW = 'irticalen:view';

/** Same-document signal so the Dock island (which also needs to know the current view) can react to
 * a change made inside the App island's settings dialog — a `localStorage` write alone does not fire
 * a `storage` event in the document that made it. */
export const VIEW_CHANGE_EVENT = 'irticalen:viewchange';

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

/** Resolves a candidate value; anything other than `'rich'` (missing, corrupt, old) is minimal. Pure. */
export function normalizeView(candidate: string | null | undefined): ViewMode {
  return candidate === 'rich' ? 'rich' : DEFAULT_VIEW;
}

/** Reads the saved view; falls back to minimal if missing/corrupt. Never throws. */
export function loadView(storage: StorageLike | undefined = defaultStorage()): ViewMode {
  try {
    return normalizeView(storage?.getItem(KEY_VIEW) ?? null);
  } catch {
    return DEFAULT_VIEW;
  }
}

/** Saves the view. Never throws. */
export function saveView(view: ViewMode, storage: StorageLike | undefined = defaultStorage()): void {
  try {
    storage?.setItem(KEY_VIEW, view);
  } catch {
    // ignore when storage is full/blocked
  }
}

/** Broadcasts a view change to other islands in the same document (see `VIEW_CHANGE_EVENT`). Never throws. */
export function broadcastViewChange(view: ViewMode): void {
  try {
    window.dispatchEvent(new CustomEvent(VIEW_CHANGE_EVENT, { detail: view }));
  } catch {
    // no window (SSR) or CustomEvent unsupported — never fatal
  }
}
