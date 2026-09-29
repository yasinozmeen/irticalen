import { describe, expect, it } from 'vitest';
import { dictionaries } from '../../../i18n';
import { speechArcStep } from '../../timer';
import { COMPOSITE_STYLES, getStyle, normalizeStyleId } from '../styles';
import { TALL_SAFE, fit, fontSpec, sceneFor } from '../styles/kit';
import type { CompositeMode, Frame, FramePhase, FrameStage, Rect, RecordAspect, StyleDefinition } from '../types';
import { fakeContext, type TextCall } from './fakeCanvas';

const MODES: CompositeMode[] = ['camera', 'screen', 'both'];
const ASPECTS: RecordAspect[] = ['wide', 'tall'];
const PHASES: FramePhase[] = ['intro', 'pre', 'speech', 'overtime', 'outro'];
const STAGES: FrameStage[] = ['idle', 'spinning', 'landed', 'research', 'ready', 'speech', 'done'];
const TOTAL = 180;
const SPEECH_AT = 14000;
const DONE_AT = SPEECH_AT + TOTAL * 1000;

function sizeOf(aspect: RecordAspect) {
  return aspect === 'wide' ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 };
}

function baseFrame(over: Partial<Frame>): Frame {
  return {
    t: 5000,
    topic: null,
    locale: 'tr',
    phase: 'pre',
    stage: 'idle',
    sessionMode: 'off-the-cuff',
    elapsedSec: 0,
    totalSec: TOTAL,
    arcStep: 0,
    micLevel: 0.4,
    mode: 'both',
    aspect: 'wide',
    ...over,
  };
}

interface Script {
  research?: boolean;
  stopAt?: number;
  locale?: 'tr' | 'en';
}

/** A whole recording as the engine would feed it: intro, idle, spin, topic, speech, time up. */
function timeline(t: number, mode: CompositeMode, aspect: RecordAspect, s: Script = {}): Frame {
  let stage: FrameStage = 'idle';
  let topic: string | null = null;
  if (t >= 8000) stage = 'spinning';
  if (t >= 10000) {
    stage = s.research ? 'research' : 'landed';
    topic = s.locale === 'en' ? 'the sunk cost fallacy' : 'batık maliyet yanılgısı';
  }
  let elapsed = 0;
  if (t >= SPEECH_AT) {
    stage = 'speech';
    elapsed = Math.min(TOTAL, Math.floor((t - SPEECH_AT) / 1000));
  }
  if (t >= DONE_AT) {
    stage = 'done';
    elapsed = TOTAL;
  }
  let phase: FramePhase = t < 3000 ? 'intro' : stage === 'speech' ? 'speech' : stage === 'done' ? 'overtime' : 'pre';
  if (s.stopAt !== undefined && t >= s.stopAt) phase = 'outro';
  return baseFrame({
    t,
    topic,
    locale: s.locale ?? 'tr',
    phase,
    stage,
    sessionMode: s.research ? 'deep-research' : 'off-the-cuff',
    elapsedSec: elapsed,
    arcStep: speechArcStep(elapsed, TOTAL),
    mode,
    aspect,
  });
}

function drawFrame(style: StyleDefinition, ctx: CanvasRenderingContext2D, f: Frame): void {
  style.drawBackground(ctx, f);
  style.layout(f.mode, f.aspect, sizeOf(f.aspect), {});
  style.drawOverlays(ctx, f);
}

/** Feeds ~5 s of history before `at` (so transitions have settled), returns the last frame's text. */
function settled(style: StyleDefinition, mode: CompositeMode, aspect: RecordAspect, at: number, s: Script = {}): TextCall[] {
  const fake = fakeContext(sizeOf(aspect).w, sizeOf(aspect).h);
  for (let t = Math.max(0, at - 5000); t < at; t += 100) drawFrame(style, fake.ctx, timeline(t, mode, aspect, s));
  fake.reset();
  drawFrame(style, fake.ctx, timeline(at, mode, aspect, s));
  return fake.texts.filter((call) => call.alpha > 0.01);
}

const MOMENTS: [string, number, Script][] = [
  ['boş (konu yok)', 6000, {}],
  ['çark dönüyor', 9000, {}],
  ['konu geldi', 12500, {}],
  ['araştırma', 12500, { research: true }],
  ['konuşma, 2. adım', SPEECH_AT + 75000, {}],
  ['süre.', DONE_AT + 800, {}],
  ['kapanış kartı', DONE_AT + 5000, {}],
  ['erken durdurma (outro)', 7000, { stopAt: 5500 }],
  ['İngilizce konuşma', SPEECH_AT + 75000, { locale: 'en' }],
];

function overlaps(t: TextCall, r: Rect): boolean {
  return t.left < r.x + r.w - 1 && t.right > r.x + 1 && t.top < r.y + r.h - 1 && t.y > r.y + 1;
}

describe('stil kaydı', () => {
  it('dört stil kayıtlı, varsayılan kâğıt', () => {
    expect(COMPOSITE_STYLES.map((s) => s.id)).toEqual(['kagit', 'balon', 'gece', 'izgara']);
    expect(normalizeStyleId('yok')).toBe('kagit');
    expect(normalizeStyleId(undefined)).toBe('kagit');
    expect(getStyle('gece').id).toBe('gece');
    expect(getStyle('yok').id).toBe('kagit');
  });

  it('her stilin adı iki dilde de var', () => {
    for (const style of COMPOSITE_STYLES) {
      for (const dict of Object.values(dictionaries)) {
        expect((dict.record.styles as Record<string, string>)[style.labelKey]).toBeTruthy();
      }
    }
  });

  it('her stil yazı tiplerini bildirir, yalnız iki oranı da destekler', () => {
    for (const style of COMPOSITE_STYLES) {
      expect(style.fonts?.length).toBeGreaterThan(0);
      expect(style.aspects).toEqual(['wide', 'tall']);
    }
  });
});

describe.each(COMPOSITE_STYLES.map((s) => [s.id, s] as const))('%s: yerleşim', (_id, style) => {
  it.each(MODES.flatMap((m) => ASPECTS.map((a) => [m, a] as const)))('%s / %s', (mode, aspect) => {
    const out = sizeOf(aspect);
    const l = style.layout(mode, aspect, out, {});
    expect(Boolean(l.cameraRect)).toBe(mode !== 'screen');
    expect(Boolean(l.screenRect)).toBe(mode !== 'camera');
    for (const r of [l.cameraRect, l.screenRect]) {
      if (!r) continue;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(out.w);
      expect(r.y + r.h).toBeLessThanOrEqual(out.h);
      expect(r.w).toBeGreaterThan(300);
      expect(r.h).toBeGreaterThan(300);
    }
    if (l.cameraRect && l.screenRect) {
      const a = l.cameraRect;
      const b = l.screenRect;
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      expect(apart).toBe(true);
    }
    // The screen is never cropped: its rect is 16:9 (a typical shared screen).
    if (l.screenRect) expect(l.screenRect.w / l.screenRect.h).toBeCloseTo(16 / 9, 1);
    // Portrait: the face (upper-middle of the camera rect) sits inside the safe area.
    if (aspect === 'tall' && l.cameraRect) {
      const cx = l.cameraRect.x + l.cameraRect.w / 2;
      const cy = l.cameraRect.y + l.cameraRect.h * 0.45;
      expect(cx).toBeGreaterThan(TALL_SAFE.x0);
      expect(cx).toBeLessThan(TALL_SAFE.x1);
      expect(cy).toBeGreaterThan(TALL_SAFE.y0);
      expect(cy).toBeLessThan(TALL_SAFE.y1);
    }
  });

  it('standart çıktıda her tikte aynı nesneyi döner, farklı çıktıda ölçekler', () => {
    const a = style.layout('both', 'wide', { w: 1920, h: 1080 }, {});
    expect(style.layout('both', 'wide', { w: 1920, h: 1080 }, {})).toBe(a);
    const half = style.layout('both', 'wide', { w: 960, h: 540 }, {});
    expect(half.cameraRect!.w).toBeCloseTo(a.cameraRect!.w / 2);
    expect(half.screenRect!.y).toBeCloseTo(a.screenRect!.y / 2);
  });
});

describe.each(COMPOSITE_STYLES.map((s) => [s.id, s] as const))('%s: çizim', (_id, style) => {
  it('her mod × oran × aşama × durum için hatasız çizer (konu yokken dahil)', () => {
    for (const mode of MODES) {
      for (const aspect of ASPECTS) {
        const fake = fakeContext(sizeOf(aspect).w, sizeOf(aspect).h);
        let t = 0;
        for (const phase of PHASES) {
          for (const stage of STAGES) {
            for (const topic of [null, 'batık maliyet yanılgısı']) {
              for (const locale of ['tr', 'en'] as const) {
                t += 120;
                const elapsed = stage === 'speech' ? 70 : stage === 'done' ? TOTAL : 0;
                const f = baseFrame({ t, phase, stage, topic, locale, mode, aspect, elapsedSec: elapsed, arcStep: speechArcStep(elapsed, TOTAL) });
                expect(() => drawFrame(style, fake.ctx, f)).not.toThrow();
              }
            }
          }
        }
        for (const call of fake.texts) expect(call.text).not.toMatch(/null|undefined|NaN/);
      }
    }
  });

  it('sıfır süre, taşan süre ve uç mikrofon değerlerinde de hatasız', () => {
    const fake = fakeContext(1920, 1080);
    const cases: Partial<Frame>[] = [
      { totalSec: 0, elapsedSec: 0, phase: 'speech', stage: 'speech' },
      { elapsedSec: 999, phase: 'overtime', stage: 'done' },
      { micLevel: -3 },
      { micLevel: 50 },
      { topic: '' },
      { topic: 'çok uzun bir konu başlığı ki hiçbir satıra tek başına sığmayacak kadar uzun kelimelerden oluşuyor' },
    ];
    let t = 0;
    for (const c of cases) {
      for (const mode of MODES) {
        t += 100;
        expect(() => drawFrame(style, fake.ctx, baseFrame({ ...c, t, mode }))).not.toThrow();
      }
    }
  });

  it.each(MOMENTS)('dikeyde yazılar güvenli alanda kalır: %s', (_name, at, script) => {
    for (const mode of MODES) {
      const texts = settled(style, mode, 'tall', at, script);
      expect(texts.length).toBeGreaterThan(0);
      for (const call of texts) {
        const where = `${mode} "${call.text}" [${Math.round(call.left)}..${Math.round(call.right)}] y ${Math.round(call.top)}..${Math.round(call.y)}`;
        expect(call.left, where).toBeGreaterThanOrEqual(TALL_SAFE.x0 - 1);
        expect(call.right, where).toBeLessThanOrEqual(TALL_SAFE.x1 + 1);
        expect(call.top, where).toBeGreaterThanOrEqual(TALL_SAFE.y0 - 1);
        expect(call.y, where).toBeLessThanOrEqual(TALL_SAFE.y1 + 1);
      }
    }
  });

  it.each(MOMENTS)('hiçbir yazı kameranın (ve kapanış dışında ekranın) üstüne binmez: %s', (name, at, script) => {
    for (const mode of MODES) {
      for (const aspect of ASPECTS) {
        const l = style.layout(mode, aspect, sizeOf(aspect), {});
        const texts = settled(style, mode, aspect, at, script);
        const closing = name === 'kapanış kartı' || name.startsWith('erken');
        for (const call of texts) {
          const where = `${mode}/${aspect} "${call.text}"`;
          if (l.cameraRect) expect(overlaps(call, l.cameraRect), where).toBe(false);
          if (l.screenRect && !closing) expect(overlaps(call, l.screenRect), where).toBe(false);
        }
      }
    }
  });

  it.each(MOMENTS.filter(([, , s]) => s.locale !== 'en'))('yazılar okunur boyutta (yatay ≥ 30 px, dikey ≥ 36 px): %s', (_name, at, script) => {
    for (const mode of MODES) {
      for (const aspect of ASPECTS) {
        const min = aspect === 'wide' ? 30 : 36;
        for (const call of settled(style, mode, aspect, at, script)) {
          expect(call.size, `${mode}/${aspect} "${call.text}"`).toBeGreaterThanOrEqual(min - 0.5);
        }
      }
    }
  });

  it('konu yokken konu adı değil yer tutucu, konu gelince konu yazılır', () => {
    for (const aspect of ASPECTS) {
      const blank = settled(style, 'both', aspect, 6000).map((c) => c.text).join(' ');
      expect(blank).not.toMatch(/batık/);
      expect(blank).toMatch(/konu/);
      const spinning = settled(style, 'both', aspect, 9000).map((c) => c.text).join(' ');
      expect(spinning).toMatch(/çekiliyor/);
      const landed = settled(style, 'both', aspect, 12500).map((c) => c.text).join(' ');
      expect(landed).toMatch(/batık/);
    }
  });

  it('açılış etiketi, adım, "süre." ve kapanış cümlesi doğru anda görünür', () => {
    const at = (t: number, s: Script = {}) => settled(style, 'both', 'wide', t, s).map((c) => c.text).join(' ');
    expect(at(6000)).toMatch(/hazırlıksız/);
    expect(at(6000)).toMatch(/3 dakika/);
    expect(at(12500, { research: true })).toMatch(/araştırma/);
    expect(at(SPEECH_AT + 75000)).toMatch(/bir örnek/);
    expect(at(DONE_AT + 800)).toMatch(/süre/);
    expect(at(DONE_AT + 800)).not.toMatch(/konu gelir/);
    expect(at(DONE_AT + 5000)).toMatch(/konu gelir, söz sende/);
    expect(at(DONE_AT + 5000)).toMatch(/irticalen\.yasinozmeen\.me/);
    expect(at(7000, { stopAt: 5500 })).toMatch(/konu gelir, söz sende/);
  });
});

describe('sahne (kit.sceneFor)', () => {
  it('etiket yuvası: açılış → araştırma → adımlar → süre', () => {
    const ctx = {};
    expect(sceneFor(ctx, baseFrame({ t: 100, phase: 'intro', stage: 'speech' })).label).toBe('mode');
    expect(sceneFor(ctx, baseFrame({ t: 4000, stage: 'research' })).label).toBe('research');
    expect(sceneFor(ctx, baseFrame({ t: 5000, phase: 'speech', stage: 'speech', arcStep: 1, elapsedSec: 70 })).label).toBe('s1');
    const done = sceneFor(ctx, baseFrame({ t: 6000, phase: 'overtime', stage: 'done', elapsedSec: TOTAL }));
    expect(done.label).toBe('done');
    expect(done.labelPrev).toBe('s1');
    expect(done.labelK).toBeLessThan(1);
    expect(sceneFor(ctx, baseFrame({ t: 7000, phase: 'overtime', stage: 'done', elapsedSec: TOTAL })).labelPrev).toBeNull();
  });

  it('kapanış kartı süre bittikten 3 sn sonra gelir; durdurunca hemen gelir', () => {
    const ctx = {};
    sceneFor(ctx, baseFrame({ t: 1000, phase: 'speech', stage: 'speech', elapsedSec: 179 }));
    expect(sceneFor(ctx, baseFrame({ t: 2000, phase: 'overtime', stage: 'done', elapsedSec: TOTAL })).end).toBe(0);
    expect(sceneFor(ctx, baseFrame({ t: 4900, phase: 'overtime', stage: 'done', elapsedSec: TOTAL })).end).toBe(0);
    expect(sceneFor(ctx, baseFrame({ t: 6000, phase: 'overtime', stage: 'done', elapsedSec: TOTAL })).end).toBe(1);

    const other = {};
    sceneFor(other, baseFrame({ t: 1000 }));
    expect(sceneFor(other, baseFrame({ t: 1500, phase: 'outro' })).end).toBe(0);
    expect(sceneFor(other, baseFrame({ t: 2600, phase: 'outro' })).end).toBe(1);
  });

  it('konu yuvası: boş → çekiliyor → konu, geçişli', () => {
    const ctx = {};
    expect(sceneFor(ctx, baseFrame({ t: 1000 })).topicKind).toBe('blank');
    expect(sceneFor(ctx, baseFrame({ t: 2000, stage: 'spinning' })).topicKind).toBe('spin');
    const landed = sceneFor(ctx, baseFrame({ t: 3000, stage: 'landed', topic: 'x' }));
    expect(landed.topicKind).toBe('topic');
    expect(landed.topicPrevKind).toBe('spin');
    expect(landed.topicK).toBe(0);
  });

  it('ilerleme saniye aralarında yumuşar ama bir sonraki saniyeyi geçmez', () => {
    const ctx = {};
    sceneFor(ctx, baseFrame({ t: 1000, phase: 'speech', stage: 'speech', elapsedSec: 10 }));
    const p = sceneFor(ctx, baseFrame({ t: 1500, phase: 'speech', stage: 'speech', elapsedSec: 10 })).progress;
    expect(p).toBeGreaterThan(10 / TOTAL);
    expect(p).toBeLessThan(11 / TOTAL);
    expect(sceneFor(ctx, baseFrame({ t: 9000, phase: 'speech', stage: 'speech', elapsedSec: 10 })).progress).toBeLessThan(11 / TOTAL);
    expect(sceneFor(ctx, baseFrame({ t: 9100, phase: 'pre', stage: 'ready' })).progress).toBe(0);
  });

  it('zaman geri giderse (önizleme döngüsü) sahne baştan kurulur', () => {
    const ctx = {};
    sceneFor(ctx, baseFrame({ t: 1000, phase: 'overtime', stage: 'done', elapsedSec: TOTAL }));
    sceneFor(ctx, baseFrame({ t: 9000, phase: 'overtime', stage: 'done', elapsedSec: TOTAL }));
    const again = sceneFor(ctx, baseFrame({ t: 10, phase: 'intro', stage: 'landed', topic: 'x' }));
    expect(again.end).toBe(0);
    expect(again.labelPrev).toBeNull();
  });
});

describe('fit', () => {
  it('kelimeyi asla bölmez; sığmazsa küçültür', () => {
    const { ctx } = fakeContext(100, 100);
    const spec = fontSpec(700, 'serif');
    const f = fit(ctx, 'batık maliyet yanılgısı', spec, 300, 2, 60, 30);
    expect(f.lines.join(' ')).toBe('batık maliyet yanılgısı');
    expect(f.lines.length).toBeLessThanOrEqual(2);
    for (const line of f.lines) expect(line.length * f.size * 0.5).toBeLessThanOrEqual(300);
    const narrow = fit(ctx, 'yanılgısı', spec, 100, 1, 60, 30);
    expect(narrow.lines).toEqual(['yanılgısı']);
    expect(narrow.size).toBeLessThan(30);
  });
});
