import { describe, expect, it } from 'vitest';
import {
  fitChapters,
  formatTimestamp,
  researchMinutes,
  sessionChapters,
  youtubePrompt,
  YOUTUBE_SKILL_URL,
  type SessionMarks,
} from '../youtube';

const labels = {
  stages: ['topla', 'kur', 'ısın'],
  arc: ['Nedir?', 'Bir örnek', 'Ne düşünüyorum?'],
  research: 'Araştırma: {stage}',
  speech: 'Konuşma: {step}',
};

const T0 = 1_000_000;
const at = (sec: number) => T0 + sec * 1000;
const lines = (chapters: { atSec: number; label: string }[]) =>
  chapters.map((c) => `${formatTimestamp(c.atSec)} ${c.label}`);

describe('formatTimestamp', () => {
  it('YouTube biçimleri', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(65)).toBe('1:05');
    expect(formatTimestamp(600)).toBe('10:00');
    expect(formatTimestamp(3725)).toBe('1:02:05');
  });
});

describe('sessionChapters', () => {
  it('araştırmalı oturum: bölümlerin gerçek başlangıçları + konuşmanın üçte birleri', () => {
    const marks: SessionMarks = {
      startedAt: T0,
      stages: [
        { stage: 'gather', at: at(0) },
        { stage: 'shape', at: at(420) },
        { stage: 'warm', at: at(540) },
      ],
      researchEndAt: at(600),
      speechAt: at(615), // 15 s waited on "ready" — stays inside "ısın"
      speechSec: 60,
    };
    expect(lines(sessionChapters(marks, labels))).toEqual([
      '0:00 Araştırma: topla',
      '7:00 Araştırma: kur',
      '9:00 Araştırma: ısın',
      '10:15 Konuşma: Nedir?',
      '10:35 Konuşma: Bir örnek',
      '10:55 Konuşma: Ne düşünüyorum?',
    ]);
    expect(researchMinutes(marks)).toBe(10);
  });

  it('hazırlıksız oturum: yalnız konuşmanın üç adımı, 0:00dan', () => {
    const marks: SessionMarks = { startedAt: T0, stages: [], researchEndAt: null, speechAt: at(0), speechSec: 60 };
    expect(lines(sessionChapters(marks, labels))).toEqual([
      '0:00 Konuşma: Nedir?',
      '0:20 Konuşma: Bir örnek',
      '0:40 Konuşma: Ne düşünüyorum?',
    ]);
    expect(researchMinutes(marks)).toBeNull();
  });

  it('hızla atlanan bölüm listelenmez; ilk bölüm yine 0:00', () => {
    const marks: SessionMarks = {
      startedAt: T0,
      stages: [
        { stage: 'gather', at: at(0) },
        { stage: 'shape', at: at(3) },
        { stage: 'warm', at: at(200) },
      ],
      researchEndAt: at(260),
      speechAt: at(262),
      speechSec: 60,
    };
    expect(lines(sessionChapters(marks, labels))[0]).toBe('0:00 Araştırma: kur');
    expect(lines(sessionChapters(marks, labels))).not.toContain('0:00 Araştırma: topla');
  });

  it('konuşma başlamadıysa bölüm yok', () => {
    const marks: SessionMarks = { startedAt: T0, stages: [], researchEndAt: null, speechAt: null, speechSec: 60 };
    expect(sessionChapters(marks, labels)).toEqual([]);
  });
});

describe('fitChapters', () => {
  it('her bölüm en az 10 sn; üçten azsa hiç', () => {
    const out = fitChapters(
      [
        { atSec: 0, label: 'a' },
        { atSec: 5, label: 'b' },
        { atSec: 30, label: 'c' },
        { atSec: 45, label: 'd' },
      ],
      60,
    );
    expect(out.map((c) => c.label)).toEqual(['b', 'c', 'd']);
    expect(out[0].atSec).toBe(0);
    for (let i = 1; i < out.length; i += 1) expect(out[i].atSec - out[i - 1].atSec).toBeGreaterThanOrEqual(10);
    expect(fitChapters([{ atSec: 0, label: 'a' }, { atSec: 30, label: 'b' }], 60)).toEqual([]);
  });

  it('videonun dışına düşen damgalar atılır', () => {
    const out = fitChapters(
      [
        { atSec: -5, label: 'x' },
        { atSec: 0, label: 'a' },
        { atSec: 20, label: 'b' },
        { atSec: 45, label: 'c' },
        { atSec: 60, label: 'd' },
      ],
      50,
    );
    expect(out.map((c) => c.label)).toEqual([]);
    const ok = fitChapters(
      [
        { atSec: 0, label: 'a' },
        { atSec: 15, label: 'b' },
        { atSec: 30, label: 'c' },
        { atSec: 60, label: 'd' },
      ],
      50,
    );
    expect(ok.map((c) => c.label)).toEqual(['a', 'b', 'c']);
  });

  it('son bölüm videonun bitişinden en az 10 sn önce', () => {
    const out = fitChapters(
      [
        { atSec: 0, label: 'a' },
        { atSec: 20, label: 'b' },
        { atSec: 40, label: 'c' },
        { atSec: 55, label: 'd' },
      ],
      60,
    );
    expect(out.map((c) => c.label)).toEqual(['a', 'b', 'c']);
  });
});

describe('youtubePrompt', () => {
  it('istek + skill bağlantısı + oturum bloğu', () => {
    const text = youtubePrompt({
      intro: 'Şu skill\'i izle: {skill}',
      topic: 'Pareto ilkesi',
      lang: 'tr',
      mode: 'deep-research',
      researchMin: 10,
      speechMin: 1,
      topicUrl: 'https://irticalen.yasinozmeen.me/konu/pareto-ilkesi/',
      chapters: [
        { atSec: 0, label: 'Araştırma: topla' },
        { atSec: 615, label: 'Konuşma: Nedir?' },
      ],
    });
    expect(text).toContain(YOUTUBE_SKILL_URL);
    expect(text).toContain('topic: Pareto ilkesi\nlang: tr\nmode: deep-research\nresearch_min: 10\nspeech_min: 1');
    expect(text).toContain('timer_chapters:\n  0:00 Araştırma: topla\n  10:15 Konuşma: Nedir?');
  });

  it('hazırlıksızda araştırma satırı yok', () => {
    const text = youtubePrompt({
      intro: '{skill}', topic: 'Borsa', lang: 'tr', mode: 'off-the-cuff', researchMin: null, speechMin: 1,
      topicUrl: 'u', chapters: [],
    });
    expect(text).not.toContain('research_min');
    expect(text).not.toContain('timer_chapters');
  });
});
