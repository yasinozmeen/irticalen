import { describe, expect, it } from 'vitest';
import { computeOgLayout } from '../ogLayout';
import { buildTopicIndex } from '../slug';

describe('computeOgLayout', () => {
  it('kısa konu tek satırda kalır', () => {
    const layout = computeOgLayout('İş', 'tr');
    expect(layout.lines.length).toBe(1);
  });

  it('hiçbir zaman 3 satırı geçmez, kelime bölünmez — tüm gerçek konularla', () => {
    for (const locale of ['tr', 'en'] as const) {
      const index = buildTopicIndex(locale);
      for (const entry of index) {
        const layout = computeOgLayout(entry.topic, locale);
        expect(layout.lines.length).toBeLessThanOrEqual(3);
        const rejoined = layout.lines.join(' ');
        const expectedWords = entry.topic.toLocaleLowerCase(locale).split(/ |(?<=-)/).filter(Boolean);
        expect(rejoined.split(' ').filter(Boolean)).toEqual(expectedWords.map((w) => w.trim()).filter(Boolean));
        expect(layout.fontSizePx).toBeGreaterThan(0);
      }
    }
  });

  it('en uzun gerçek konu için satır sayısı ve punto makul', () => {
    const layout = computeOgLayout('One Thousand and One Nights', 'en');
    expect(layout.lines.length).toBeLessThanOrEqual(3);
    expect(layout.fontSizePx).toBeLessThanOrEqual(72);
  });
});
