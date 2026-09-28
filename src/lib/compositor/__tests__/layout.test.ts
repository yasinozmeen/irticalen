import { describe, expect, it } from 'vitest';
import { coverCrop, cornerPip, fullBleed, outputSizeForAspect, stackedBands } from '../layout';

describe('outputSizeForAspect', () => {
  it('wide -> 1920x1080, tall -> 1080x1920', () => {
    expect(outputSizeForAspect('wide')).toEqual({ w: 1920, h: 1080 });
    expect(outputSizeForAspect('tall')).toEqual({ w: 1080, h: 1920 });
  });
});

describe('coverCrop', () => {
  it('kaynak hedeften daha geniş oranlıysa sağ/sol kırpılır', () => {
    // 2:1 source into a 16:9 dest — source is relatively wider, crop left/right.
    const crop = coverCrop({ w: 2000, h: 1000 }, { w: 1600, h: 900 });
    expect(crop.sh).toBe(1000);
    expect(crop.sw).toBeCloseTo(1000 * (1600 / 900));
    expect(crop.sx).toBeCloseTo((2000 - crop.sw) / 2);
    expect(crop.sy).toBe(0);
  });

  it('kaynak hedeften daha dar oranlıysa üst/alt kırpılır', () => {
    // 1:2 (portrait) source into a 16:9 dest — source is relatively taller, crop top/bottom.
    const crop = coverCrop({ w: 1000, h: 2000 }, { w: 1600, h: 900 });
    expect(crop.sw).toBe(1000);
    expect(crop.sh).toBeCloseTo(1000 / (1600 / 900));
    expect(crop.sy).toBeCloseTo((2000 - crop.sh) / 2);
    expect(crop.sx).toBe(0);
  });

  it('aynı oranda kırpma yapılmaz (tüm kaynak kullanılır)', () => {
    const crop = coverCrop({ w: 1920, h: 1080 }, { w: 960, h: 540 });
    expect(crop).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });

  it('boş/bilinmeyen kaynak ya da hedef ile bölme hatası vermez', () => {
    expect(coverCrop({ w: 0, h: 0 }, { w: 100, h: 100 })).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
    expect(coverCrop({ w: 100, h: 100 }, { w: 0, h: 0 })).toEqual({ sx: 0, sy: 0, sw: 100, sh: 100 });
  });
});

describe('fullBleed', () => {
  it('tüm çıktıyı kaplayan dikdörtgen döner', () => {
    expect(fullBleed({ w: 1920, h: 1080 })).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
  });
});

describe('cornerPip', () => {
  it('sağ alt köşeye, çıktının içine sığan bir dikdörtgen döner', () => {
    const output = { w: 1920, h: 1080 };
    const pip = cornerPip(output);
    expect(pip.x).toBeGreaterThan(0);
    expect(pip.y).toBeGreaterThan(0);
    expect(pip.x + pip.w).toBeLessThanOrEqual(output.w);
    expect(pip.y + pip.h).toBeLessThanOrEqual(output.h);
    // 16:9 kabul edilir
    expect(pip.w / pip.h).toBeCloseTo(16 / 9, 1);
  });
});

describe('stackedBands', () => {
  it('üst ve alt bandın toplam yüksekliği çıktıyı tam kaplar', () => {
    const output = { w: 1080, h: 1920 };
    const { top, bottom } = stackedBands(output);
    expect(top.y).toBe(0);
    expect(bottom.y).toBe(top.h);
    expect(top.h + bottom.h).toBe(output.h);
    expect(top.w).toBe(output.w);
    expect(bottom.w).toBe(output.w);
  });
});
