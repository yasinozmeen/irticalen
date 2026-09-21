import type { Locale } from '../i18n';

/**
 * Breaks a topic into "paper" lines for the F design's big lowercase topic display.
 * Words are never cut mid-word: each word stays whole, short neighbouring words may
 * share a line, and only an existing hyphen in the source text is a valid break point
 * (because splitting happens on spaces or right after a hyphen).
 *
 * Ported 1:1 from design-options/mock.html's `paperLines()` (the F reference build).
 *
 * @param topic the raw topic text (any case)
 * @param locale drives locale-aware lowercasing (tr: İ→i, I→ı; en: I→i)
 * @param max soft character budget per line (default 7, matching the reference)
 */
export function paperLines(topic: string, locale: Locale, max = 7): string[] {
  const lower = topic.toLocaleLowerCase(locale);
  const words = lower.split(/ |(?<=-)/).filter((word) => word.length > 0);

  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && !line.endsWith('-') && (line + ' ' + word).length <= max) {
      line += ' ' + word;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  return lines.length ? lines : [lower];
}
