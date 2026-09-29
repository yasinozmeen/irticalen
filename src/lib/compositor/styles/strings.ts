import type { Locale } from '../../types';

/**
 * The words the recording styles burn into the video. Kept here (not in `src/i18n`) because they are
 * part of the video's artwork — lowercase, set per style — and the canvas code needs them without a
 * Preact dictionary in reach. Keep in step with the site copy: the arc steps mirror `timer.arc`, the
 * tagline mirrors `modes.offTheCuffBlurb`.
 */
export interface StyleStrings {
  readonly offTheCuff: string;
  readonly deepResearch: string;
  /** "3 dakika" / "3 minutes" — the speech length as it appears in the opening label. */
  duration(totalSec: number): string;
  readonly steps: readonly [string, string, string];
  /** Without the full stop: styles colour the dot themselves. */
  readonly timeUp: string;
  readonly research: string;
  readonly topic: string;
  readonly drawing: string;
  readonly remaining: string;
  /** Without the full stop. */
  readonly tagline: string;
  readonly address: string;
  readonly wordmark: string;
}

const ADDRESS = 'irticalen.yasinozmeen.me';

const tr: StyleStrings = {
  offTheCuff: 'hazırlıksız',
  deepResearch: 'araştırmalı',
  duration(totalSec) {
    if (totalSec >= 60 && totalSec % 60 === 0) return `${totalSec / 60} dakika`;
    return `${Math.max(0, Math.round(totalSec))} saniye`;
  },
  steps: ['nedir?', 'bir örnek', 'ne düşünüyorum?'],
  timeUp: 'süre',
  research: 'araştırma',
  topic: 'konu',
  drawing: 'çekiliyor',
  remaining: 'kalan',
  tagline: 'konu gelir, söz sende',
  address: ADDRESS,
  wordmark: 'irticalen',
};

const en: StyleStrings = {
  offTheCuff: 'off the cuff',
  deepResearch: 'researched',
  duration(totalSec) {
    if (totalSec >= 60 && totalSec % 60 === 0) {
      const minutes = totalSec / 60;
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }
    return `${Math.max(0, Math.round(totalSec))} seconds`;
  },
  steps: ['what is it?', 'an example', 'what do I think?'],
  timeUp: 'time',
  research: 'research',
  topic: 'topic',
  drawing: 'drawing',
  remaining: 'left',
  tagline: 'the topic lands, the floor is yours',
  address: ADDRESS,
  wordmark: 'irticalen',
};

export function stringsFor(locale: Locale): StyleStrings {
  return locale === 'en' ? en : tr;
}
