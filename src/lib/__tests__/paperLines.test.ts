import { describe, expect, it } from 'vitest';
import { paperLines } from '../paperLines';

describe('paperLines', () => {
  it('kelimeler asla bölünmez: her satır tam kelimelerden oluşur', () => {
    const topic = 'Saatleri Ayarlama Enstitüsü';
    const lines = paperLines(topic, 'tr');
    const words = topic.toLocaleLowerCase('tr').split(' ');
    const rejoined = lines.join(' ').split(' ');
    expect(rejoined).toEqual(words);
    for (const line of lines) {
      for (const word of line.split(' ')) {
        expect(words).toContain(word);
      }
    }
  });

  it('kısa komşu kelimeler aynı satırı paylaşır (max=7 varsayılan)', () => {
    // "ilk" (3) + " " + "adım" (4) = 8 chars, still <= max(7)? no: length 8 > 7 -> should NOT merge.
    // Use two clearly short words that fit within budget.
    const lines = paperLines('ev iş', 'tr');
    expect(lines).toEqual(['ev iş']);
  });

  it('uzun kelimeler tek satırda kalır, birleştirilmez', () => {
    const lines = paperLines('Mükemmeliyetçilik', 'tr');
    expect(lines).toEqual(['mükemmeliyetçilik']);
  });

  it('tireli konu tireden kırılabilir', () => {
    const lines = paperLines('Dunning-Kruger etkisi', 'en');
    expect(lines[0].endsWith('-')).toBe(true);
    expect(lines.join('')).not.toContain('--');
    // The word after the hyphen starts its own line.
    expect(lines.some((l) => l.startsWith('kruger'))).toBe(true);
  });

  it('tek kelimeli konu tek satır döner', () => {
    expect(paperLines('Girişimcilik', 'tr')).toEqual(['girişimcilik']);
  });

  it('boş konu için boş dizi elemanı döner, çökmez', () => {
    expect(() => paperLines('', 'tr')).not.toThrow();
    const lines = paperLines('', 'tr');
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.join('')).toBe('');
  });

  it("TR küçük harfe çevirme: İ -> i, I -> ı", () => {
    expect(paperLines('İlk Müşteri', 'tr')).toEqual(paperLines('ilk müşteri'.toLocaleUpperCase('tr'), 'tr'));
    const lines = paperLines('İlk', 'tr');
    expect(lines[0]).toBe('ilk');
    const lines2 = paperLines('ISI', 'tr');
    expect(lines2[0]).toBe('ısı');
  });

  it('EN küçük harfe çevirme: I -> i (Türkçe ı DEĞİL)', () => {
    const lines = paperLines('INSTITUTE', 'en');
    expect(lines[0].startsWith('i')).toBe(true);
    expect(lines[0]).not.toContain('ı');
  });

  it('custom max parametresi satır uzunluğunu etkiler', () => {
    const lines = paperLines('bir iki üç dört', 'tr', 3);
    // every word is its own line since max=3 is shorter than most words + separators
    expect(lines.length).toBeGreaterThan(1);
  });
});
