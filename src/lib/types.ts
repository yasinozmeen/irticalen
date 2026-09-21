/** Speaking mode: unprepared (off-the-cuff) or researched (deep-research). */
export type Mode = 'off-the-cuff' | 'deep-research';

/** The session's current phase. */
export type Phase = 'idle' | 'research' | 'ready' | 'speech' | 'done';

/** UI language. */
export type Locale = 'tr' | 'en';

/** A topic category (selectable only in off-the-cuff mode). */
export interface Category {
  id: string;
  label: string;
  topics: string[];
}

/** User settings (persisted). */
export interface Settings {
  speechSec: number;
  researchSec: number;
  muted: boolean;
}
