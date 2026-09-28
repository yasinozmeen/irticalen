import { describe, expect, it } from 'vitest';
import { COMPOSITE_STYLES, getStyle, normalizeAspect, normalizeStyleId, resolveAspectForStyle } from '../styles';
import { kagit } from '../styles/kagit';
import type { CompositeMode, RecordAspect } from '../types';

describe('normalizeStyleId', () => {
  it('kayıtlı bir id\'yi olduğu gibi döner', () => {
    expect(normalizeStyleId('kagit')).toBe('kagit');
  });

  it('bilinmeyen/bozuk değer varsayılan (ilk kayıtlı) stile düşer', () => {
    expect(normalizeStyleId('bilinmeyen')).toBe(COMPOSITE_STYLES[0].id);
    expect(normalizeStyleId(undefined)).toBe(COMPOSITE_STYLES[0].id);
    expect(normalizeStyleId(null)).toBe(COMPOSITE_STYLES[0].id);
    expect(normalizeStyleId(42)).toBe(COMPOSITE_STYLES[0].id);
  });
});

describe('normalizeAspect', () => {
  it('yalnız "tall" tall sayılır, geri kalan wide', () => {
    expect(normalizeAspect('tall')).toBe('tall');
    expect(normalizeAspect('wide')).toBe('wide');
    expect(normalizeAspect('xx')).toBe('wide');
    expect(normalizeAspect(undefined)).toBe('wide');
  });
});

describe('getStyle', () => {
  it('bilinen id için doğru stili döner', () => {
    expect(getStyle('kagit')).toBe(kagit);
  });

  it('bilinmeyen id için ilk kayıtlı stile düşer', () => {
    expect(getStyle('bilinmeyen')).toBe(COMPOSITE_STYLES[0]);
  });
});

describe('resolveAspectForStyle', () => {
  it('stilin desteklediği oranı olduğu gibi döner', () => {
    expect(resolveAspectForStyle(kagit, 'tall')).toBe('tall');
    expect(resolveAspectForStyle(kagit, 'wide')).toBe('wide');
  });

  it('desteklenmeyen bir oran verilirse stilin ilk desteklediği orana düşer', () => {
    const wideOnly = { ...kagit, aspects: ['wide'] as const };
    expect(resolveAspectForStyle(wideOnly, 'tall')).toBe('wide');
  });
});

describe('kagit.layout', () => {
  const modes: CompositeMode[] = ['camera', 'screen', 'both'];
  const aspects: RecordAspect[] = ['wide', 'tall'];

  it('her mod × oran kombinasyonu için en az bir kaynağa dikdörtgen atar, hiçbiri taşmaz', () => {
    for (const mode of modes) {
      for (const aspect of aspects) {
        const output = aspect === 'wide' ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 };
        const result = kagit.layout(mode, aspect, output, {});
        const rects = [result.cameraRect, result.screenRect].filter((r): r is NonNullable<typeof r> => Boolean(r));
        expect(rects.length).toBeGreaterThan(0);
        for (const rect of rects) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.w).toBeLessThanOrEqual(output.w);
          expect(rect.y + rect.h).toBeLessThanOrEqual(output.h);
        }
      }
    }
  });

  it('camera modu yalnız cameraRect, screen modu yalnız screenRect verir', () => {
    const output = { w: 1920, h: 1080 };
    expect(kagit.layout('camera', 'wide', output, {}).screenRect).toBeUndefined();
    expect(kagit.layout('screen', 'wide', output, {}).cameraRect).toBeUndefined();
  });

  it('both modu her iki dikdörtgeni de verir ve örtüşmez (wide: köşe pip, tall: üst/alt bant)', () => {
    const wideOutput = { w: 1920, h: 1080 };
    const wide = kagit.layout('both', 'wide', wideOutput, {});
    expect(wide.cameraRect).toBeDefined();
    expect(wide.screenRect).toBeDefined();

    const tallOutput = { w: 1080, h: 1920 };
    const tall = kagit.layout('both', 'tall', tallOutput, {});
    expect(tall.cameraRect).toBeDefined();
    expect(tall.screenRect).toBeDefined();
    // Stacked bands: no vertical overlap between the two rects.
    const [a, b] = [tall.screenRect!, tall.cameraRect!].sort((x, y) => x.y - y.y);
    expect(a.y + a.h).toBeLessThanOrEqual(b.y);
  });
});
