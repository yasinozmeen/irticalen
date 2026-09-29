import type { CompositeLayout, CompositeMode, Frame, Rect, RecordAspect, Size } from '../types';
import { stringsFor, type StyleStrings } from './strings';

/**
 * Shared drawing kit for the recording styles: easing, cached text measurement, word-safe fitting,
 * the logo mark, and the per-canvas "scene" (what each slot shows right now and how far its
 * transition has run).
 *
 * Coordinates: every style draws in the *logical* output space — 1920×1080 ('wide') or 1080×1920
 * ('tall') — never in `ctx.canvas` pixels. The recording canvas is exactly that size; the settings
 * preview draws the same thing into a small canvas under a `setTransform` scale. Styles therefore
 * never call `setTransform`/`translate`/`scale` themselves.
 */

export type Ctx = CanvasRenderingContext2D;

export const WIDE: Size = { w: 1920, h: 1080 };
export const TALL: Size = { w: 1080, h: 1920 };

export function logicalSize(aspect: RecordAspect): Size {
  return aspect === 'wide' ? WIDE : TALL;
}

/** Vertical safe area (9:16): text, logo and cards stay inside it; only ground and video may bleed. */
export const TALL_SAFE = { x0: 120, x1: 960, y0: 120, y1: 1660 } as const;

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

// ---------------------------------------------------------------------------------------------
// Easing

export function clamp(x: number, a = 0, b = 1): number {
  return x < a ? a : x > b ? b : x;
}
export function eOut(x: number): number {
  const c = clamp(x);
  return 1 - (1 - c) * (1 - c) * (1 - c);
}
export function eInOut(x: number): number {
  const c = clamp(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}
export function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

// ---------------------------------------------------------------------------------------------
// Fonts and text measurement

/** A font face minus its size — module-level constants in each style, so fitting can be cached. */
export interface FontSpec {
  readonly key: string;
  readonly style: 'normal' | 'italic';
  readonly weight: number;
  /** CSS family list, e.g. `"'Space Grotesk', sans-serif"`. */
  readonly family: string;
  /** Letter spacing in em (canvas `letterSpacing`, where supported). */
  readonly trackEm: number;
}

export function fontSpec(weight: number, family: string, style: 'normal' | 'italic' = 'normal', trackEm = 0): FontSpec {
  return { key: `${style}|${weight}|${family}|${trackEm}`, style, weight, family, trackEm };
}

const fontStringCache = new Map<string, string>();

/** Sets `ctx.font` (and letter spacing, where the browser supports it) for `spec` at `size` px. */
export function setFont(ctx: Ctx, spec: FontSpec, size: number): void {
  const px = Math.round(size);
  const key = `${spec.key}|${px}`;
  let css = fontStringCache.get(key);
  if (css === undefined) {
    css = `${spec.style === 'italic' ? 'italic ' : ''}${spec.weight} ${px}px ${spec.family}`;
    if (fontStringCache.size > 400) fontStringCache.clear();
    fontStringCache.set(key, css);
  }
  ctx.font = css;
  const withSpacing = ctx as Ctx & { letterSpacing?: string };
  if ('letterSpacing' in withSpacing) {
    withSpacing.letterSpacing = spec.trackEm === 0 ? '0px' : `${Math.round(spec.trackEm * px * 10) / 10}px`;
  }
}

const widthCache = new Map<string, number>();
const fitCache = new Map<string, Fitted>();
let fontsListenerAttached = false;

/** Drops every cached measurement — a font that finished loading changes all metrics. */
export function invalidateTextCache(): void {
  widthCache.clear();
  fitCache.clear();
}

function attachFontsListener(): void {
  if (fontsListenerAttached) return;
  fontsListenerAttached = true;
  try {
    const fonts = (globalThis as { document?: { fonts?: EventTarget } }).document?.fonts;
    fonts?.addEventListener?.('loadingdone', invalidateTextCache);
  } catch {
    // no FontFaceSet (tests, workers) — measurements simply never go stale there
  }
}

/** `measureText(text).width` for the current `ctx.font`, cached. */
export function measure(ctx: Ctx, text: string): number {
  attachFontsListener();
  const spacing = (ctx as Ctx & { letterSpacing?: string }).letterSpacing ?? '';
  const key = `${ctx.font}|${spacing}|${text}`;
  let width = widthCache.get(key);
  if (width === undefined) {
    width = ctx.measureText(text).width;
    if (widthCache.size > 2000) widthCache.clear();
    widthCache.set(key, width);
  }
  return width;
}

export interface Fitted {
  readonly lines: readonly string[];
  readonly size: number;
}

function wrapWords(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (!word) continue;
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(ctx, candidate) > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Fits `text` into at most `maxLines` lines of `maxW`, shrinking the size from `size` towards
 * `minSize`. A word is never broken or hyphenated: if even `minSize` can't hold the longest word, the
 * size keeps shrinking (down to 60% of `minSize`) rather than overflowing. Cached per input.
 */
export function fit(ctx: Ctx, text: string, spec: FontSpec, maxW: number, maxLines: number, size: number, minSize: number): Fitted {
  const key = `${spec.key}|${text}|${Math.round(maxW)}|${maxLines}|${size}|${minSize}`;
  const cached = fitCache.get(key);
  if (cached) {
    setFont(ctx, spec, cached.size);
    return cached;
  }
  let result: Fitted | null = null;
  const floor = Math.max(8, Math.floor(minSize * 0.6));
  for (let s = size; s > floor; s -= 2) {
    setFont(ctx, spec, s);
    const lines = wrapWords(ctx, text, maxW);
    if (lines.length <= maxLines && lines.every((line) => measure(ctx, line) <= maxW)) {
      result = { lines, size: s };
      break;
    }
  }
  if (!result) {
    setFont(ctx, spec, floor);
    result = { lines: wrapWords(ctx, text, maxW), size: floor };
  }
  setFont(ctx, spec, result.size);
  if (fitCache.size > 300) fitCache.clear();
  fitCache.set(key, result);
  return result;
}

/** Largest size ≤ `max` at which `text` is at most `maxW` wide (single line). */
export function fitSize(ctx: Ctx, text: string, spec: FontSpec, maxW: number, max: number): number {
  setFont(ctx, spec, 100);
  const w100 = measure(ctx, text);
  if (w100 <= 0) return max;
  return Math.max(8, Math.min(max, Math.floor((maxW / w100) * 100)));
}

export function text(ctx: Ctx, s: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left'): void {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

export function fill(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

export function fillR(ctx: Ctx, r: Rect, color: string): void {
  fill(ctx, r.x, r.y, r.w, r.h, color);
}

export function diamond(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
}

/** Mürekkep cetveli: base line + 13 ticks (12 intervals) + a bar filling from the left. */
export function ruler(
  ctx: Ctx,
  x0: number,
  x1: number,
  yb: number,
  p: number,
  colors: { base: string; tick: string; bar: string },
  tickH: number,
  barH: number,
): void {
  const w = x1 - x0;
  fill(ctx, x0, yb - 2, w, 2, colors.base);
  ctx.fillStyle = colors.tick;
  for (let i = 0; i <= 12; i += 1) {
    const x = x0 + (w * i) / 12 - (i === 12 ? 2 : 0);
    ctx.fillRect(x, yb - tickH, 2, tickH);
  }
  fill(ctx, x0, yb - barH, w * clamp(p), barH, colors.bar);
}

/** "MM:SS" — strings for whole seconds are cached (at most one hour's worth). */
const clockCache: string[] = [];
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds - 1e-6));
  if (s < 3600) {
    const hit = clockCache[s];
    if (hit) return hit;
  }
  const out = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  if (s < 3600) clockCache[s] = out;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Logo — the site's speech bubble (`Logo.tsx` / `logo.css`), same states, drawn on canvas.

export type LogoState = 'idle' | 'spinning' | 'research' | 'ready' | 'speech' | 'done';

export interface LogoColors {
  readonly bubble: string;
  readonly mark: string;
  readonly accent: string;
  /** Wordmark colour; `null` draws the bubble alone. */
  readonly word: string | null;
  readonly dot: string;
  readonly font: FontSpec;
}

const BUBBLE_PTS = [0, 0, 92, 0, 92, 70, 40, 70, 14, 94, 14, 70, 0, 70] as const;
const MARK_X = [22, 46, 70] as const;

function hop(tSec: number, delay: number): number {
  const p = ((((tSec - delay) / 0.48) % 1) + 1) % 1;
  if (p < 0.3) return eOut(p / 0.3);
  if (p < 0.6) return 1 - eOut((p - 0.3) / 0.3);
  return 0;
}

function think(tSec: number, delay: number): number {
  const p = ((((tSec - delay) / 1.5) % 1) + 1) % 1;
  return p < 0.4 ? eOut(p / 0.4) : 1 - eOut((p - 0.4) / 0.6);
}

/**
 * Draws the logo with its baseline at `base` (the bubble sits on it like a capital letter) and
 * returns its total width. `size` is the wordmark's font size; the bubble is as tall as `size`.
 */
export function drawLogo(
  ctx: Ctx,
  x: number,
  base: number,
  size: number,
  colors: LogoColors,
  state: LogoState,
  levels: ArrayLike<number>,
  tSec: number,
  wordmark = 'irticalen',
): number {
  const k = size / 94;
  const top = base - size * 0.8;
  ctx.fillStyle = colors.bubble;
  ctx.beginPath();
  for (let i = 0; i < BUBBLE_PTS.length; i += 2) {
    const px = x + BUBBLE_PTS[i] * k;
    const py = top + BUBBLE_PTS[i + 1] * k;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  if (state === 'speech') {
    for (let i = 0; i < 3; i += 1) {
      const h = 40 * clamp(levels[i] ?? 0.5, 0.2, 1);
      const cx = MARK_X[i];
      fill(ctx, x + (cx - 6) * k, top + (35 - h / 2) * k, 12 * k, h * k, i === 1 ? colors.accent : colors.mark);
    }
  } else if (state === 'done') {
    fill(ctx, x + 14 * k, top + 28 * k, 64 * k, 14 * k, colors.accent);
  } else {
    for (let i = 0; i < 3; i += 1) {
      const cx = x + MARK_X[i] * k;
      let cy = top + 35 * k;
      let r = 10 * k;
      let color = state === 'ready' || (state === 'idle' && i === 1) ? colors.accent : colors.mark;
      let alpha = 1;
      if (state === 'spinning') {
        const h = hop(tSec, i * 0.16);
        cy -= 9 * h * k;
        if (h > 0.5) color = colors.accent;
      } else if (state === 'research') {
        const p = think(tSec, i * 0.25);
        alpha = 0.28 + 0.72 * p;
        r *= 0.8 + 0.2 * p;
      }
      if (alpha < 1) ctx.globalAlpha = alpha;
      diamond(ctx, cx, cy, r, color);
      if (alpha < 1) ctx.globalAlpha = 1;
    }
  }
  const bubbleW = 92 * k;
  if (colors.word === null) return bubbleW;
  const wx = x + bubbleW + size * 0.36;
  setFont(ctx, colors.font, size);
  text(ctx, wordmark, wx, base, colors.word);
  const ww = measure(ctx, wordmark);
  text(ctx, '.', wx + ww, base, colors.dot);
  return wx + ww + measure(ctx, '.') - x;
}

// ---------------------------------------------------------------------------------------------
// Scene: what each slot shows on this frame, and how far its transition has run.

/** The label slot: opening/mode line → research → the three outline steps → "süre.". */
export type LabelKey = 'mode' | 'research' | 's0' | 's1' | 's2' | 'done';
/** The topic slot: nothing yet (a blank to be filled) → the wheel is spinning → a landed topic. */
export type TopicKind = 'blank' | 'spin' | 'topic';

export const LABEL_MS = 450;
export const TOPIC_MS = 420;
/** The closing card comes this long after time is up (the recording can't be extended afterwards,
 * so it can't wait for "stop"), or at once when the speaker stops before that. */
export const END_DELAY_MS = 3000;
export const END_MS = 900;

export interface Scene {
  W: number;
  H: number;
  wide: boolean;
  /** Seconds since the recording started — drives idle loops (logo hop, spinner). */
  tSec: number;
  str: StyleStrings;
  /** "hazırlıksız" / "araştırmalı". */
  modeName: string;
  /** "3 dakika". */
  durationText: string;
  running: boolean;
  timeUp: boolean;
  /** Speech progress 0..1, smoothed between the timer's whole-second updates. */
  progress: number;
  /** Remaining speech time as "MM:SS" (the full length before the timer starts). */
  clockText: string;
  /** The full speech length as "MM:SS". */
  totalClock: string;
  logo: LogoState;
  levels: [number, number, number];

  label: LabelKey;
  labelPrev: LabelKey | null;
  /** 0..1 eased progress of the current label's entrance (1 = settled). */
  labelK: number;

  topicKind: TopicKind;
  topicText: string | null;
  topicPrevKind: TopicKind | null;
  topicPrevText: string | null;
  topicK: number;

  /** Outline step the style's colour/shape state follows (0 before the speech, 2 once time is up). */
  arc: 0 | 1 | 2;
  arcPrev: 0 | 1 | 2;
  arcK: number;

  /** 0..1 progress of the closing card (0 = not yet). */
  end: number;
}

interface Tracker {
  scene: Scene;
  lastT: number;
  labelAt: number;
  topicAt: number;
  arcAt: number;
  timeUpAt: number | null;
  outroAt: number | null;
  wasRunning: boolean;
  elapsedVal: number;
  elapsedAt: number;
  modeKey: string;
}

const trackers = new WeakMap<object, Tracker>();

function labelFor(frame: Frame, running: boolean, timeUp: boolean): LabelKey {
  if (timeUp) return 'done';
  if (frame.phase === 'intro') return 'mode';
  if (running) return frame.arcStep === 0 ? 's0' : frame.arcStep === 1 ? 's1' : 's2';
  if (frame.stage === 'research') return 'research';
  return 'mode';
}

function logoFor(frame: Frame, running: boolean, timeUp: boolean): LogoState {
  if (timeUp) return 'done';
  if (running) return 'speech';
  switch (frame.stage) {
    case 'spinning':
      return 'spinning';
    case 'research':
      return 'research';
    case 'landed':
    case 'ready':
      return 'ready';
    default:
      return 'idle';
  }
}

function freshTracker(frame: Frame): Tracker {
  const size = logicalSize(frame.aspect);
  const str = stringsFor(frame.locale);
  const scene: Scene = {
    W: size.w,
    H: size.h,
    wide: frame.aspect === 'wide',
    tSec: 0,
    str,
    modeName: '',
    durationText: '',
    running: false,
    timeUp: false,
    progress: 0,
    clockText: '00:00',
    totalClock: '00:00',
    logo: 'idle',
    levels: [0.28, 0.28, 0.28],
    label: 'mode',
    labelPrev: null,
    labelK: 1,
    topicKind: 'blank',
    topicText: null,
    topicPrevKind: null,
    topicPrevText: null,
    topicK: 1,
    arc: 0,
    arcPrev: 0,
    arcK: 1,
    end: 0,
  };
  return {
    scene,
    lastT: Number.NEGATIVE_INFINITY,
    labelAt: Number.NEGATIVE_INFINITY,
    topicAt: Number.NEGATIVE_INFINITY,
    arcAt: Number.NEGATIVE_INFINITY,
    timeUpAt: null,
    outroAt: null,
    wasRunning: false,
    elapsedVal: 0,
    elapsedAt: 0,
    modeKey: '',
  };
}

/**
 * The scene for this frame on this canvas. State (transition start times, smoothing) is kept per
 * canvas context, so the recording and the settings preview never disturb each other. The first
 * frame a context sees starts fully settled; time running backwards (the preview's loop restarting)
 * starts over. Mutates and returns the same object every frame — no per-frame allocation.
 */
export function sceneFor(ctx: object, frame: Frame): Scene {
  let tr = trackers.get(ctx);
  const first = !tr || frame.t < tr.lastT - 250 || tr.scene.wide !== (frame.aspect === 'wide');
  if (!tr || first) {
    tr = freshTracker(frame);
    trackers.set(ctx, tr);
  }
  const sc = tr.scene;
  const t = frame.t;
  tr.lastT = t;
  sc.tSec = t / 1000;
  sc.str = stringsFor(frame.locale);

  const modeKey = `${frame.locale}|${frame.sessionMode}|${frame.totalSec}`;
  if (modeKey !== tr.modeKey) {
    tr.modeKey = modeKey;
    sc.modeName = frame.sessionMode === 'deep-research' ? sc.str.deepResearch : sc.str.offTheCuff;
    sc.durationText = sc.str.duration(frame.totalSec);
  }

  const timeUp = frame.phase === 'overtime' || frame.stage === 'done';
  const running = !timeUp && (frame.phase === 'speech' || frame.stage === 'speech');
  sc.timeUp = timeUp;
  sc.running = running;

  // Progress, smoothed between the countdown's whole-second updates (never runs ahead by a second).
  const total = frame.totalSec;
  sc.totalClock = clock(total);
  if (running) {
    if (!tr.wasRunning || frame.elapsedSec !== tr.elapsedVal) {
      tr.elapsedVal = frame.elapsedSec;
      tr.elapsedAt = t;
    }
    const smooth = Math.min(total, frame.elapsedSec + clamp((t - tr.elapsedAt) / 1000, 0, 0.98));
    sc.progress = total > 0 ? clamp(smooth / total) : 0;
    sc.clockText = clock(Math.max(0, total - frame.elapsedSec));
  } else if (timeUp) {
    sc.progress = 1;
    sc.clockText = clock(0);
  } else {
    sc.progress = 0;
    sc.clockText = clock(total);
  }
  tr.wasRunning = running;

  sc.logo = logoFor(frame, running, timeUp);
  const mic = clamp(frame.micLevel);
  for (let i = 0; i < 3; i += 1) {
    const wobble = 0.72 + 0.28 * Math.sin(sc.tSec * (7.3 + i * 2.1) + i * 1.9);
    sc.levels[i] = 0.28 + 0.72 * clamp(mic * wobble * 1.35);
  }

  // Label slot.
  const label = labelFor(frame, running, timeUp);
  if (first) {
    sc.label = label;
    sc.labelPrev = null;
  } else if (label !== sc.label) {
    sc.labelPrev = sc.label;
    sc.label = label;
    tr.labelAt = t;
  }
  sc.labelK = eOut((t - tr.labelAt) / LABEL_MS);
  if (sc.labelK >= 1) sc.labelPrev = null;

  // Topic slot.
  const kind: TopicKind = frame.stage === 'spinning' ? 'spin' : frame.topic ? 'topic' : 'blank';
  const topicText = kind === 'topic' ? frame.topic : null;
  if (first) {
    sc.topicKind = kind;
    sc.topicText = topicText;
    sc.topicPrevKind = null;
    sc.topicPrevText = null;
  } else if (kind !== sc.topicKind || topicText !== sc.topicText) {
    sc.topicPrevKind = sc.topicKind;
    sc.topicPrevText = sc.topicText;
    sc.topicKind = kind;
    sc.topicText = topicText;
    tr.topicAt = t;
  }
  sc.topicK = eOut((t - tr.topicAt) / TOPIC_MS);
  if (sc.topicK >= 1) sc.topicPrevKind = null;

  // Arc (outline step) for styles whose shapes follow it.
  const arc: 0 | 1 | 2 = timeUp ? 2 : running ? frame.arcStep : 0;
  if (first) {
    sc.arc = arc;
    sc.arcPrev = arc;
  } else if (arc !== sc.arc) {
    sc.arcPrev = sc.arc;
    sc.arc = arc;
    tr.arcAt = t;
  }
  sc.arcK = eOut((t - tr.arcAt) / LABEL_MS);
  if (sc.arcK >= 1) sc.arcPrev = sc.arc;

  // Closing card.
  if (timeUp) {
    if (tr.timeUpAt === null) tr.timeUpAt = t;
  } else {
    tr.timeUpAt = null;
  }
  if (frame.phase === 'outro') {
    if (tr.outroAt === null) tr.outroAt = t;
  } else {
    tr.outroAt = null;
  }
  const endAt = Math.min(
    tr.timeUpAt === null ? Number.POSITIVE_INFINITY : tr.timeUpAt + END_DELAY_MS,
    tr.outroAt === null ? Number.POSITIVE_INFINITY : tr.outroAt,
  );
  sc.end = endAt === Number.POSITIVE_INFINITY ? 0 : eInOut((t - endAt) / END_MS);
  return sc;
}

/** Smallest text size allowed on this canvas: 30 px landscape, 36 px portrait (≈ 13 pt on a phone). */
export function minText(sc: Scene): number {
  return sc.wide ? 30 : 36;
}

/** Forgets the scene kept for `ctx` (e.g. when the preview switches style). */
export function resetScene(ctx: object): void {
  trackers.delete(ctx);
}

// ---------------------------------------------------------------------------------------------
// Layout helpers

export type LayoutKey = `${CompositeMode}|${RecordAspect}`;

/**
 * Turns a style's cached logical rects into the engine's `CompositeLayout`, scaling when the engine
 * ever asks for an output other than the standard 1920×1080 / 1080×1920. The standard case returns
 * the same object every call (the engine asks every tick).
 */
export function toCompositeLayout(
  cache: Map<string, CompositeLayout>,
  key: string,
  aspect: RecordAspect,
  output: Size,
  cam: Rect | undefined,
  scr: Rect | undefined,
): CompositeLayout {
  const base = logicalSize(aspect);
  const sx = output.w / base.w;
  const sy = output.h / base.h;
  if (sx === 1 && sy === 1) {
    let hit = cache.get(key);
    if (!hit) {
      hit = { ...(cam ? { cameraRect: cam } : {}), ...(scr ? { screenRect: scr } : {}) };
      cache.set(key, hit);
    }
    return hit;
  }
  const scale = (r: Rect): Rect => ({ x: r.x * sx, y: r.y * sy, w: r.w * sx, h: r.h * sy });
  return { ...(cam ? { cameraRect: scale(cam) } : {}), ...(scr ? { screenRect: scale(scr) } : {}) };
}
