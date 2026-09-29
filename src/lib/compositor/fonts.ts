import type { StyleDefinition } from './types';
import { invalidateTextCache } from './styles/kit';

/**
 * Loads the Google Fonts a recording style draws with. A canvas never waits for a font: text drawn
 * before its face has loaded silently uses a fallback, and a face the page has declared but never
 * used isn't fetched at all. So before the first frame: add the Google Fonts stylesheet (the site's
 * CSP allows only fonts.googleapis.com / fonts.gstatic.com — no self-hosted fonts), then
 * `document.fonts.load` every face with Turkish sample text so the latin-ext subset (ı ğ ş İ) comes
 * too, and confirm with `document.fonts.check`.
 *
 * Font spec format (`StyleDefinition.fonts`): `"Family:weights"`, weights comma-separated with an
 * optional `i` suffix for italic — `'Newsreader:400,400i,600'`, `'Space Grotesk:500,700'`.
 */

export interface StyleFontFace {
  readonly family: string;
  readonly weight: number;
  readonly italic: boolean;
}

/** Families the site's own `<head>` already links (see `Base.astro`) — loaded, never re-linked. */
const SITE_FAMILIES = new Set(['Newsreader']);

/** Covers the latin and latin-ext subsets, digits and the punctuation the styles draw. */
export const FONT_SAMPLE = 'irticalen süre. ığüşöç İĞÜŞÖÇ 0123456789:·/?';

const DEFAULT_TIMEOUT_MS = 8000;

export function parseFontSpec(spec: string): StyleFontFace[] {
  const colon = spec.lastIndexOf(':');
  const family = (colon >= 0 ? spec.slice(0, colon) : spec).trim();
  if (!family) return [];
  const list = colon >= 0 ? spec.slice(colon + 1) : '400';
  const faces: StyleFontFace[] = [];
  for (const part of list.split(',')) {
    const token = part.trim();
    const italic = token.endsWith('i');
    const weight = Number.parseInt(italic ? token.slice(0, -1) : token, 10);
    if (!Number.isFinite(weight) || weight < 100 || weight > 900) continue;
    if (!faces.some((f) => f.weight === weight && f.italic === italic)) faces.push({ family, weight, italic });
  }
  return faces;
}

/** CSS font shorthands for `document.fonts.load`/`check`, one per face. */
export function fontDescriptors(specs: readonly string[]): string[] {
  const out: string[] = [];
  for (const spec of specs) {
    for (const face of parseFontSpec(spec)) {
      out.push(`${face.italic ? 'italic ' : ''}${face.weight} 40px "${face.family}"`);
    }
  }
  return out;
}

/**
 * The Google Fonts CSS2 URL for every family not already on the page, or `null` if there is none.
 * Axis tuples are sorted (italic first, then weight) — Google rejects unsorted lists.
 */
export function googleFontsHref(specs: readonly string[]): string | null {
  const params: string[] = [];
  const seen = new Set<string>();
  for (const spec of specs) {
    const faces = parseFontSpec(spec);
    if (faces.length === 0) continue;
    const family = faces[0].family;
    if (SITE_FAMILIES.has(family) || seen.has(family)) continue;
    seen.add(family);
    const name = family.replace(/ /g, '+');
    const hasItalic = faces.some((f) => f.italic);
    const sorted = [...faces].sort((a, b) => Number(a.italic) - Number(b.italic) || a.weight - b.weight);
    if (hasItalic) {
      params.push(`family=${name}:ital,wght@${sorted.map((f) => `${f.italic ? 1 : 0},${f.weight}`).join(';')}`);
    } else {
      params.push(`family=${name}:wght@${sorted.map((f) => f.weight).join(';')}`);
    }
  }
  if (params.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=block`;
}

const stylesheetLoads = new Map<string, Promise<void>>();

function addStylesheet(doc: Document, href: string): Promise<void> {
  const known = stylesheetLoads.get(href);
  if (known) return known;
  const promise = new Promise<void>((resolve) => {
    const existing = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).find((l) => l.href === href);
    if (existing) {
      // Already on the page (e.g. added before this module was re-evaluated) — assume parsed.
      resolve();
      return;
    }
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.irticalenFonts = '';
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
    doc.head.appendChild(link);
  });
  stylesheetLoads.set(href, promise);
  // A failed stylesheet may be retried on the next call.
  void promise.then(() => {
    const ok = Array.from(doc.styleSheets).some((s) => s.href === href);
    if (!ok) stylesheetLoads.delete(href);
  });
  return promise;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export interface EnsureFontsOptions {
  readonly doc?: Document;
  readonly timeoutMs?: number;
}

/**
 * Makes sure every face in `specs` is loaded. Resolves `true` when all are usable, `false` on
 * failure or timeout (the caller decides whether to go on with fallback fonts — a recording should
 * say so rather than start unstyled). Never rejects. Safe to call repeatedly; work is shared.
 */
export async function ensureFonts(specs: readonly string[], options: EnsureFontsOptions = {}): Promise<boolean> {
  const doc = options.doc ?? (typeof document === 'undefined' ? undefined : document);
  if (!doc || !doc.fonts || specs.length === 0) return specs.length === 0;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const run = async (): Promise<boolean> => {
    const href = googleFontsHref(specs);
    if (href) await addStylesheet(doc, href);
    const descriptors = fontDescriptors(specs);
    // `load` resolves with the matching faces — empty means the family was never declared (the
    // stylesheet failed), which `check` alone would report as fine (nothing left to load).
    const loaded = await Promise.all(descriptors.map((d) => doc.fonts.load(d, FONT_SAMPLE).catch(() => [])));
    const ok = descriptors.every((d, i) => {
      try {
        return loaded[i].length > 0 && doc.fonts.check(d, FONT_SAMPLE);
      } catch {
        return false;
      }
    });
    invalidateTextCache();
    return ok;
  };
  return withTimeout(run(), timeoutMs, false);
}

/** `ensureFonts` for one style's declared fonts. */
export function ensureStyleFonts(style: Pick<StyleDefinition, 'fonts'>, options?: EnsureFontsOptions): Promise<boolean> {
  return ensureFonts(style.fonts ?? [], options);
}
