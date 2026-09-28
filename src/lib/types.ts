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

/** User settings (persisted). */
export interface Settings {
  speechSec: number;
  researchSec: number;
  muted: boolean;
  /** Clock and ruler are blurred while the timer runs (the visitor chose not to watch the time). */
  hideClock: boolean;
}
