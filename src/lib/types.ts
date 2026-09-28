/** Speaking mode: unprepared (off-the-cuff) or researched (deep-research). */
export type Mode = 'off-the-cuff' | 'deep-research';

/** The session's current phase. */
export type Phase = 'idle' | 'research' | 'ready' | 'speech' | 'done';

/** UI language. */
export type Locale = 'tr' | 'en';

/** A sub-group inside a category's topic pool (e.g. the deep-research pool's "fields"). */
export interface CategoryGroup {
  id: string;
  label: string;
  topics: string[];
}

/** A topic category (selectable only in off-the-cuff mode). `topics` is always the flat list to
 * spin from; a category authored with `groups` instead has its `topics` filled in by the loader
 * (see `flattenCategoryGroups`) as the groups' topics concatenated in order. */
export interface Category {
  id: string;
  label: string;
  topics: string[];
  groups?: CategoryGroup[];
}

/**
 * "Kendini kaydet": off (default), camera+mic, screen+mic, or both. Entirely device-local — nothing
 * is ever uploaded anywhere.
 */
export type RecordMode = 'off' | 'camera' | 'screen' | 'both';

/**
 * How a non-'off' recording ends up as file(s): 'template' composites everything (camera/screen,
 * topic label, progress line, …) into a single styled file (see `src/lib/compositor`); 'raw' keeps
 * today's behavior of plain, uncomposited file(s) (two, for 'both').
 */
export type RecordFormat = 'template' | 'raw';

/** Composite recording output aspect — 16:9 landscape or 9:16 portrait. Only meaningful for
 * `recordFormat: 'template'`; see `src/lib/compositor`. */
export type RecordAspect = 'wide' | 'tall';

/** User settings (persisted). */
export interface Settings {
  speechSec: number;
  researchSec: number;
  muted: boolean;
  /** Clock and ruler are blurred while the timer runs (the visitor chose not to watch the time). */
  hideClock: boolean;
  record: RecordMode;
  recordFormat: RecordFormat;
  /** An id from the compositor's style registry (`src/lib/compositor/styles`). */
  recordStyle: string;
  recordAspect: RecordAspect;
}
