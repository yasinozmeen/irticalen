import { describe, expect, it, vi } from 'vitest';
import { FONT_SAMPLE, ensureFonts, ensureStyleFonts, fontDescriptors, googleFontsHref, parseFontSpec } from '../fonts';
import { COMPOSITE_STYLES } from '../styles';

describe('parseFontSpec', () => {
  it('aileyi, ağırlıkları ve italikleri ayırır', () => {
    expect(parseFontSpec('Space Grotesk:500,700')).toEqual([
      { family: 'Space Grotesk', weight: 500, italic: false },
      { family: 'Space Grotesk', weight: 700, italic: false },
    ]);
    expect(parseFontSpec('Newsreader:400i,600')).toEqual([
      { family: 'Newsreader', weight: 400, italic: true },
      { family: 'Newsreader', weight: 600, italic: false },
    ]);
    expect(parseFontSpec('Figtree')).toEqual([{ family: 'Figtree', weight: 400, italic: false }]);
    expect(parseFontSpec('X:abc,1200')).toEqual([]);
  });
});

describe('googleFontsHref', () => {
  it('Google Fonts CSS2 adresi üretir, eksenleri sıralar, sitenin kendi fontunu atlar', () => {
    const href = googleFontsHref(['Space Grotesk:700,500', 'Newsreader:400,600', 'Instrument Sans:600,400i']);
    expect(href).toBe(
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Instrument+Sans:ital,wght@0,600;1,400&display=block',
    );
    expect(googleFontsHref(['Newsreader:400'])).toBeNull();
  });

  it('her stilin fontları yalnız Google Fonts adresinden gelir', () => {
    for (const style of COMPOSITE_STYLES) {
      const href = googleFontsHref(style.fonts ?? []);
      if (href) expect(href.startsWith('https://fonts.googleapis.com/css2?')).toBe(true);
      expect(fontDescriptors(style.fonts ?? []).length).toBeGreaterThan(0);
    }
  });
});

function fakeDoc(loadResult: (d: string) => unknown[] | Promise<unknown[]>) {
  const doc = document.implementation.createHTMLDocument('t');
  const load = vi.fn((d: string, _text: string) => Promise.resolve(loadResult(d)));
  const check = vi.fn(() => true);
  Object.defineProperty(doc, 'fonts', { value: { load, check } });
  // The stylesheet "loads" as soon as it is appended.
  const append = doc.head.appendChild.bind(doc.head);
  doc.head.appendChild = <T extends Node>(node: T): T => {
    const out = append(node);
    setTimeout(() => node.dispatchEvent(new Event('load')), 0);
    return out;
  };
  return { doc, load, check };
}

describe('ensureFonts', () => {
  it('stil sayfasını ekler, her yüzü Türkçe örnek metinle yükler', async () => {
    const { doc, load } = fakeDoc(() => [{}]);
    const gece = COMPOSITE_STYLES.find((s) => s.id === 'gece')!;
    await expect(ensureStyleFonts(gece, { doc })).resolves.toBe(true);
    const links = doc.head.querySelectorAll('link[rel="stylesheet"]');
    expect(links.length).toBe(1);
    expect((links[0] as HTMLLinkElement).href).toContain('Space+Grotesk');
    expect(load).toHaveBeenCalledTimes(fontDescriptors(gece.fonts!).length);
    expect(load.mock.calls[0][1]).toBe(FONT_SAMPLE);
    expect(FONT_SAMPLE).toMatch(/ı/);
    expect(FONT_SAMPLE).toMatch(/İ/);
  });

  it('bir yüz bulunamazsa false döner', async () => {
    const { doc } = fakeDoc((d) => (d.includes('700') ? [] : [{}]));
    await expect(ensureFonts(['Figtree:500,700'], { doc })).resolves.toBe(false);
  });

  it('zaman aşımında false döner, asla reddetmez', async () => {
    const { doc } = fakeDoc(() => new Promise(() => undefined));
    await expect(ensureFonts(['Big Shoulders Display:900'], { doc, timeoutMs: 20 })).resolves.toBe(false);
  });

  it('boş listede işi yok', async () => {
    await expect(ensureFonts([])).resolves.toBe(true);
  });
});
