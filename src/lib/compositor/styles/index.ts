import type { RecordAspect, StyleDefinition } from '../types';
import { balon } from './balon';
import { gece } from './gece';
import { izgara } from './izgara';
import { kagit } from './kagit';

/** Every registered style, in the order Settings offers them; the first is the default. Add a new
 * style by writing its file next to `kagit.ts` (see the contract in `../types`'s `StyleDefinition`
 * doc, and `./kit` for the shared drawing kit) and listing it here. */
export const COMPOSITE_STYLES: readonly StyleDefinition[] = [kagit, balon, gece, izgara];

const DEFAULT_STYLE_ID = COMPOSITE_STYLES[0].id;

/** Looks up a style by id; an unknown id (e.g. one dropped from a future release) falls back to the
 * first registered style rather than throwing. */
export function getStyle(id: string): StyleDefinition {
  return COMPOSITE_STYLES.find((style) => style.id === id) ?? COMPOSITE_STYLES[0];
}

/** Normalizes an untrusted (e.g. localStorage) style id; anything not currently registered falls
 * back to the default style. */
export function normalizeStyleId(raw: unknown): string {
  if (typeof raw === 'string' && COMPOSITE_STYLES.some((style) => style.id === raw)) return raw;
  return DEFAULT_STYLE_ID;
}

/** Normalizes an untrusted aspect value; anything other than `'tall'` is `'wide'`. */
export function normalizeAspect(raw: unknown): RecordAspect {
  return raw === 'tall' ? 'tall' : 'wide';
}

/** Clamps a saved (style, aspect) pair to one the style actually supports — every style declares at
 * least one aspect, so `aspects[0]` is always a safe fallback. */
export function resolveAspectForStyle(style: StyleDefinition, aspect: RecordAspect): RecordAspect {
  return style.aspects.includes(aspect) ? aspect : style.aspects[0];
}
