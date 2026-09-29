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
 * Where in the recording this frame falls — distinct from the app's own session `Phase`:
 * - `intro`: the first ~3s of the *recording* itself (see `INTRO_MS`), whatever the app is doing;
 * - `pre`: the recording runs but the speech timer has not started yet — the speaker may be giving
 *   an introduction, spinning the wheel, looking at the landed topic or researching (see `stage`);
 * - `speech`: the speech timer is running;
 * - `overtime`: the speech timer has run out but the recording keeps going;
 * - `outro`: the ~2s grace period after "kaydı durdur", before the file is finalized (`OUTRO_MS`).
 * A recording may start before the wheel is spun, so any of these can follow `intro`.
 */
export type FramePhase = 'intro' | 'pre' | 'speech' | 'overtime' | 'outro';

/** What the app shows while the recording runs — lets a style say "konu çekiliyor", show the landed
 * topic, the research stage, etc. `done` = the speech timer has finished. */
export type FrameStage = 'idle' | 'spinning' | 'landed' | 'research' | 'ready' | 'speech' | 'done';

/**
 * Everything a style's draw hooks need for one frame. Recomputed every tick (~30fps, degrading to
 * ~24fps under load — see `engine.ts`) by the engine: styles must stay fast and allocation-light in
 * `drawBackground`/`drawOverlays`.
 */
export interface Frame {
  /** Milliseconds since the composite recording itself started (drives `intro`). */
  readonly t: number;
  /** `null` until a topic has landed (recording started before the first spin). May change mid-recording
   * when the speaker spins again before starting the timer. */
  readonly topic: string | null;
  readonly locale: Locale;
  readonly phase: FramePhase;
  readonly stage: FrameStage;
  /** Session mode: hazırlıksız or araştırmalı (drives e.g. the opening label). */
  readonly sessionMode: 'off-the-cuff' | 'deep-research';
  /** Speech timer's elapsed/total seconds — 0/total before the timer starts, both hold steady at
   * `totalSec` once time is up. */
  readonly elapsedSec: number;
  readonly totalSec: number;
  /** Which third of the speech outline (Nedir?/örnek/Ne düşünüyorum) — see `speechArcStep`; 0 before
   * the speech timer starts. */
  readonly arcStep: 0 | 1 | 2;
  /** Current microphone level 0..1 (smoothed), for level-reactive marks such as the logo bars. */
  readonly micLevel: number;
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
  /** Google Fonts this style draws with, as `"Family:weights"` (`i` suffix = italic), e.g.
   * `'Space Grotesk:500,600,700'` or `'Newsreader:400,400i,600'`. Load them with
   * `ensureStyleFonts` (`../fonts`) before the first frame — canvas silently falls back otherwise.
   * Only Google Fonts are allowed (the site's CSP permits no other font origin). */
  readonly fonts?: readonly string[];
  layout(mode: CompositeMode, aspect: RecordAspect, output: Size, sources: CompositeSources): CompositeLayout;
  drawBackground(ctx: CanvasRenderingContext2D, frame: Frame): void;
  drawOverlays(ctx: CanvasRenderingContext2D, frame: Frame): void;
}

/** `RecordMode` minus `'off'` — `null` when there is nothing to composite. */
export function compositeModeFor(mode: 'off' | CompositeMode): CompositeMode | null {
  return mode === 'off' ? null : mode;
}
