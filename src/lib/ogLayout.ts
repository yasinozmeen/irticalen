import type { Locale } from './types';
import { paperLines } from './paperLines';

export interface OgLayout {
  lines: string[];
  /** Topic font size in px, at the 1200×630 canvas scale. */
  fontSizePx: number;
}

const MAX_LINES = 3;

/**
 * Lays out a topic for the 1200×630 OG image: at most 3 lines, words never split, font size
 * shrinks as the topic gets longer/wraps more. Pure — no rendering, just numbers, so it's testable
 * without satori. Reuses `paperLines`' word-safe wrapping with a growing character budget until the
 * topic fits in MAX_LINES.
 */
export function computeOgLayout(topic: string, locale: Locale): OgLayout {
  let budget = 10;
  let lines = paperLines(topic, locale, budget);
  while (lines.length > MAX_LINES && budget < 200) {
    budget += 3;
    lines = paperLines(topic, locale, budget);
  }

  const longest = Math.max(...lines.map((line) => line.length));

  let fontSizePx: number;
  if (lines.length === 1) {
    fontSizePx = longest <= 12 ? 108 : longest <= 18 ? 88 : 72;
  } else if (lines.length === 2) {
    fontSizePx = longest <= 12 ? 88 : 72;
  } else {
    fontSizePx = longest <= 12 ? 68 : 56;
  }

  // Words are never broken, so one very long word is the only way to overflow. Bold Newsreader runs
  // ~0.58em per character; scale down until the longest line fits the 1072px text column.
  const maxByWidth = Math.floor(1072 / (longest * 0.58));
  fontSizePx = Math.max(28, Math.min(fontSizePx, maxByWidth));

  return { lines, fontSizePx };
}
