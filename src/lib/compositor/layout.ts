import type { Rect, Size, RecordAspect } from './types';

/** The two fixed output resolutions, always 30fps (see `engine.ts`) — 16:9 landscape or 9:16
 * portrait. `RecordAspect` never maps to anything else, so this is total. */
export function outputSizeForAspect(aspect: RecordAspect): Size {
  return aspect === 'wide' ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 };
}

/** The source-rectangle half of an `object-fit: cover` crop: how much of `source` to read (via
 * `drawImage`'s 9-argument crop form) so it fills `dest` edge-to-edge without distortion, cropping
 * whichever axis overflows. Degenerates to the whole source when either size is empty/unknown (the
 * caller then draws nothing useful, but never divides by zero). */
export function coverCrop(source: Size, dest: Size): { sx: number; sy: number; sw: number; sh: number } {
  if (source.w <= 0 || source.h <= 0 || dest.w <= 0 || dest.h <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(0, source.w), sh: Math.max(0, source.h) };
  }
  const sourceRatio = source.w / source.h;
  const destRatio = dest.w / dest.h;
  if (sourceRatio > destRatio) {
    // Source is relatively wider than dest — crop its left/right edges.
    const sw = source.h * destRatio;
    return { sx: (source.w - sw) / 2, sy: 0, sw, sh: source.h };
  }
  // Source is relatively taller than (or equal to) dest — crop its top/bottom edges.
  const sh = source.w / destRatio;
  return { sx: 0, sy: (source.h - sh) / 2, sw: source.w, sh };
}

/** A full-bleed rect covering the whole output — the layout for any single-source mode
 * ('camera'-only or 'screen'-only), at any aspect. */
export function fullBleed(output: Size): Rect {
  return { x: 0, y: 0, w: output.w, h: output.h };
}

/** A small 16:9 picture-in-picture rect inset into a corner of `output` — used by 'both' mode's
 * wide-aspect layout (main feed full-bleed, the other feed as this corner inset). */
export function cornerPip(output: Size, scale = 0.27, margin = 0.035): Rect {
  const w = output.w * scale;
  const h = (w * 9) / 16;
  const marginPx = output.w * margin;
  return { x: output.w - w - marginPx, y: output.h - h - marginPx, w, h };
}

/** Splits `output` into a top and bottom band (top gets `topShare` of the height) — used by 'both'
 * mode's tall-aspect layout, stacking the two feeds instead of insetting a corner pip (a portrait
 * canvas is too narrow for a legible pip). */
export function stackedBands(output: Size, topShare = 0.62): { top: Rect; bottom: Rect } {
  const topH = Math.round(output.h * topShare);
  return {
    top: { x: 0, y: 0, w: output.w, h: topH },
    bottom: { x: 0, y: topH, w: output.w, h: output.h - topH },
  };
}
