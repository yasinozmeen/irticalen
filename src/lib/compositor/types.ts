import type { Locale, RecordAspect } from '../types';

export type { RecordAspect };

/** Which stream(s) are actually being composited — `RecordMode` minus `'off'` (nothing to
 * composite when recording is off). */
export type CompositeMode = 'camera' | 'screen' | 'both';

export interface Size {
  readonly w: number;
  readonly h: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Natural size of each source actually present for this mode — absent when that source isn't
 * captured (e.g. no `screen` in 'camera' mode) or not yet known (before its video metadata loads). */
export interface CompositeSources {
  readonly camera?: Size;
  readonly screen?: Size;
}

/** Where each source is drawn on the output canvas. A mode that doesn't use a source omits its rect. */
export interface CompositeLayout {
  readonly cameraRect?: Rect;
  readonly screenRect?: Rect;
}

/**
 * Where in the recording this frame falls — distinct from the app's speech `Phase`: `intro` is the
 * first ~3s of the *recording* itself (see `INTRO_MS`), `overtime` is once the speech timer has run
 * out but the recording keeps going, and `outro` is the ~2s grace period after "kaydı durdur" is
 * pressed, before the file is actually finalized (see `OUTRO_MS`/`computeFramePhase` in `./frame`).
 */
export type FramePhase = 'intro' | 'speech' | 'overtime' | 'outro';

/**
 * Everything a style's draw hooks need for one frame. Recomputed every tick (~30fps, degrading to
 * ~24fps under load — see `engine.ts`) by the engine: styles must stay fast and allocation-light in
 * `drawBackground`/`drawOverlays`.
 */
export interface Frame {
  /** Milliseconds since the composite recording itself started (drives `intro`). */
  readonly t: number;
  readonly topic: string;
  readonly locale: Locale;
  readonly phase: FramePhase;
  /** Speech timer's elapsed/total seconds — both hold steady at `totalSec` once time is up. */
  readonly elapsedSec: number;
  readonly totalSec: number;
  /** Which third of the speech outline (Nedir?/örnek/Ne düşünüyorum) — see `speechArcStep`. */
  readonly arcStep: 0 | 1 | 2;
  readonly mode: CompositeMode;
  readonly aspect: RecordAspect;
}

/**
 * A visual style for the composited ('template' format) recording. `layout` is pure and
 * unit-tested; the two draw hooks touch a real `CanvasRenderingContext2D` and are only exercised
 * visually — keep them fast (called every tick) and allocation-light.
 *
 * Contract for a new style file (see `styles/kagit.ts` for a full worked example):
 * - `id` is stable and persisted (`irticalen:recordStyle`) — never rename or reuse an id.
 * - `aspects` lists which of `'wide'`/`'tall'` this style actually supports. The settings UI and
 *   `resolveAspectForStyle` both fall back to `aspects[0]` when a saved combination is invalid, so
 *   every style must declare at least one.
 * - `layout` must be pure and total: for every `mode`/`aspect` combination this style declares
 *   support for, it returns a rect for every source actually present in `sources` (a mode that
 *   doesn't use a source, e.g. `screenRect` in `'camera'` mode, simply omits that key). `sources`
 *   carries each stream's *natural* pixel size — most styles can ignore it (rects are usually fixed
 *   by `mode`/`aspect`/`output` alone) and pass `{}` when previewing without real streams.
 * - `drawBackground` paints the *entire* canvas before any camera/screen video frame is drawn onto
 *   it via `layout`'s rects (the engine does that drawing, not the style) — it is the frame around
 *   and behind the video, e.g. paper, a border, or a placeholder tone before a stream's first frame
 *   arrives. It must fully cover the canvas (no relying on a previous frame showing through).
 * - `drawOverlays` paints *after* the video frames (topic label, progress line, wordmark, …) and may
 *   call this style's own `layout` again (with `{}` sources) to align overlays to the same rects.
 */
export interface StyleDefinition {
  readonly id: string;
  /** Key into `dict.record.styles` — the label shown in Settings and used by `TemplatePreview`. */
  readonly labelKey: string;
  readonly aspects: readonly RecordAspect[];
  layout(mode: CompositeMode, aspect: RecordAspect, output: Size, sources: CompositeSources): CompositeLayout;
  drawBackground(ctx: CanvasRenderingContext2D, frame: Frame): void;
  drawOverlays(ctx: CanvasRenderingContext2D, frame: Frame): void;
}

/** `RecordMode` minus `'off'` — `null` when there is nothing to composite. */
export function compositeModeFor(mode: 'off' | CompositeMode): CompositeMode | null {
  return mode === 'off' ? null : mode;
}
