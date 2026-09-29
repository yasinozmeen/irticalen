import type { CompositeLayout, CompositeMode, CompositeSources, Frame, Rect, RecordAspect, Size, StyleDefinition } from '../types';
import {
  clamp,
  diamond,
  drawLogo,
  eOut,
  fill,
  fillR,
  fit,
  fitSize,
  fontSpec,
  measure,
  minText,
  rect,
  ruler,
  sceneFor,
  setFont,
  text,
  toCompositeLayout,
  type Ctx,
  type LabelKey,
  type LogoColors,
  type Scene,
  type TopicKind,
} from './kit';

/**
 * balon — the brand's own world: cobalt ground with a faint tile lattice (the logo's diamonds at 5%),
 * the camera speaking from inside the logo's sharp speech bubble, the screen as a glaze-edged tile
 * with a hard, unblurred offset shadow. The timer is 12 diamonds filling one by one (all coral when
 * time is up). Before a topic lands the topic line reads "konu ◆ ▁▁▁" and the diamonds hop while the
 * wheel spins. At the end a second bubble "answers" the camera, carrying the logo, the tagline and
 * the address.
 */

const COB = '#173f8a';
const DEEP = '#0d285c';
const SHADOW = '#071736';
const GLAZE = '#f3f7fb';
const CORAL = '#d8402f';
const GLAZE_22 = 'rgba(243,247,251,0.22)';
const GLAZE_60 = 'rgba(243,247,251,0.6)';
const LATTICE = 'rgba(243,247,251,0.05)';
const DEEP_25 = 'rgba(13,40,92,0.25)';
const DEEP_45 = 'rgba(13,40,92,0.45)';
const DEEP_50 = 'rgba(13,40,92,0.5)';
const CAM_TONE = '#c9d3e3';

const SANS = 'Figtree, system-ui, sans-serif';
const SER = 'Newsreader, Georgia, serif';
const F_WORD = fontSpec(600, SER);
const F_LABEL = fontSpec(700, SANS);
const F_DONE = fontSpec(800, SANS);
const F_NUM = fontSpec(700, SANS, 'normal', 0.08);
const F_TOPIC = fontSpec(700, SANS, 'normal', -0.01);
const F_DIGITS = fontSpec(500, SER, 'normal', -0.04);
const F_STEP = fontSpec(700, SANS);
const F_STEP_DIM = fontSpec(500, SANS);
const F_TAG = fontSpec(800, SANS);
const F_ADDR = fontSpec(600, SANS);

const LOGO: LogoColors = { bubble: GLAZE, mark: COB, accent: CORAL, word: GLAZE, dot: CORAL, font: F_WORD };
const END_LOGO: LogoColors = { bubble: COB, mark: GLAZE, accent: CORAL, word: DEEP, dot: CORAL, font: F_WORD };
const NUMS = ['01', '02', '03'] as const;
const RULER = { base: DEEP_25, tick: DEEP_50, bar: DEEP } as const;

type Dir = 'bl' | 'br';

interface BL {
  readonly scr?: Rect;
  /** The whole camera bubble (body + tail); `cam` is its body, where the video goes. */
  readonly bubble?: Rect;
  readonly cam?: Rect;
  /** Timer tile (camera-only and screen-only). */
  readonly tile?: Rect;
  readonly end: Rect;
  readonly endIsScreen: boolean;
  readonly dir: Dir;
  readonly logo: readonly [number, number, number];
  readonly label: readonly [number, number, number];
  /** x, baseline, width, size */
  readonly topic: readonly [number, number, number, number];
  /** x, centre y, pitch, radius */
  readonly beads: readonly [number, number, number, number];
}

function tailOf(h: number): { t: number; tw: number; tx: (w: number) => number } {
  const t = Math.round(clamp(h * 0.12, 40, 90));
  return { t, tw: Math.round(t * 1.1), tx: (w) => Math.round(Math.min(w * 0.15, 180)) };
}

function withBubble(b: Rect): { bubble: Rect; cam: Rect } {
  return { bubble: b, cam: rect(b.x, b.y, b.w, b.h - tailOf(b.h).t) };
}

function build(mode: CompositeMode, aspect: RecordAspect): BL {
  if (aspect === 'wide') {
    const head = { logo: [72, 90, 36], label: [1848, 88, 38], beads: [1464, 986, 32, 10], dir: 'br' as Dir } as const;
    if (mode === 'both') {
      const scr = rect(72, 132, 1120, 630);
      return { ...head, scr, ...withBubble(rect(1236, 132, 612, 780)), topic: [72, 960, 1100, 66], end: scr, endIsScreen: true };
    }
    if (mode === 'camera') {
      const tile = rect(1292, 292, 556, 400);
      return { ...head, dir: 'bl', ...withBubble(rect(72, 132, 1180, 748)), tile, topic: [72, 1000, 1300, 60], end: tile, endIsScreen: false };
    }
    const scr = rect(267, 132, 1386, 780);
    return { ...head, scr, topic: [72, 1000, 1300, 60], end: scr, endIsScreen: true };
  }
  const head = { logo: [120, 196, 38], label: [960, 194, 42], beads: [120, 350, 30, 9], topic: [120, 300, 840, 50], dir: 'bl' as Dir } as const;
  if (mode === 'both') {
    const scr = rect(120, 392, 840, 472);
    return { ...head, scr, ...withBubble(rect(120, 902, 840, 746)), end: scr, endIsScreen: true };
  }
  if (mode === 'camera') {
    const tile = rect(120, 1300, 840, 348);
    return { ...head, ...withBubble(rect(120, 392, 840, 880)), tile, end: tile, endIsScreen: false };
  }
  return { ...head, scr: rect(120, 392, 840, 472), tile: rect(120, 920, 840, 440), end: rect(120, 392, 840, 968), endIsScreen: true };
}

const layouts = new Map<string, BL>();
function L(mode: CompositeMode, aspect: RecordAspect): BL {
  const key = `${mode}|${aspect}`;
  let hit = layouts.get(key);
  if (!hit) {
    hit = build(mode, aspect);
    layouts.set(key, hit);
  }
  return hit;
}

const composite = new Map<string, CompositeLayout>();
function layout(mode: CompositeMode, aspect: RecordAspect, output: Size, _sources: CompositeSources): CompositeLayout {
  const l = L(mode, aspect);
  return toCompositeLayout(composite, `${mode}|${aspect}`, aspect, output, l.cam, l.scr);
}

// ---------------------------------------------------------------------------------------------
// Ground: cobalt + lattice, painted once into an offscreen canvas per size and copied each frame.

const grounds = new Map<string, HTMLCanvasElement | null>();

function paintLattice(g: Ctx, W: number, H: number): void {
  g.fillStyle = COB;
  g.fillRect(0, 0, W, H);
  g.fillStyle = LATTICE;
  g.beginPath();
  for (let y = 0; y <= H + 64; y += 64) {
    for (let x = 0; x <= W + 64; x += 64) {
      const cx = x + ((y / 64) % 2) * 32;
      g.moveTo(cx, y - 6);
      g.lineTo(cx + 6, y);
      g.lineTo(cx, y + 6);
      g.lineTo(cx - 6, y);
      g.closePath();
    }
  }
  g.fill();
}

function groundCanvas(W: number, H: number): HTMLCanvasElement | null {
  const key = `${W}x${H}`;
  if (grounds.has(key)) return grounds.get(key) ?? null;
  let canvas: HTMLCanvasElement | null = null;
  try {
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      if (g) {
        paintLattice(g, W, H);
        canvas = c;
      }
    }
  } catch {
    canvas = null;
  }
  grounds.set(key, canvas);
  return canvas;
}

/** Paints the ground over `r` (whole canvas when omitted) — also how the screen "fades out". */
function ground(ctx: Ctx, sc: Scene, x = 0, y = 0, w = sc.W, h = sc.H): void {
  const g = groundCanvas(sc.W, sc.H);
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const w0 = Math.min(sc.W, x + w) - x0;
  const h0 = Math.min(sc.H, y + h) - y0;
  if (w0 <= 0 || h0 <= 0) return;
  if (g) ctx.drawImage(g, x0, y0, w0, h0, x0, y0, w0, h0);
  else fill(ctx, x0, y0, w0, h0, COB);
}

// ---------------------------------------------------------------------------------------------
// Frames: glaze edge + hard offset shadow (a flat shape, never a blur).

function shape(ctx: Ctx, r: Rect, bubble: boolean, dir: Dir, dx = 0, dy = 0): void {
  const x = r.x + dx;
  const y = r.y + dy;
  const { w, h } = r;
  ctx.beginPath();
  if (!bubble) {
    ctx.rect(x, y, w, h);
    return;
  }
  const tail = tailOf(h);
  const tx = tail.tx(w);
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - tail.t);
  if (dir === 'br') {
    ctx.lineTo(x + w - tx, y + h - tail.t);
    ctx.lineTo(x + w - tx, y + h);
    ctx.lineTo(x + w - tx - tail.tw, y + h - tail.t);
  } else {
    ctx.lineTo(x + tx + tail.tw, y + h - tail.t);
    ctx.lineTo(x + tx, y + h);
    ctx.lineTo(x + tx, y + h - tail.t);
  }
  ctx.lineTo(x, y + h - tail.t);
  ctx.closePath();
}

function edge(r: Rect): { b: number; sh: number } {
  return r.w < 600 ? { b: 7, sh: 10 } : { b: 9, sh: 14 };
}

function frame(ctx: Ctx, r: Rect, bubble: boolean, dir: Dir): void {
  const { b, sh } = edge(r);
  ctx.lineJoin = 'miter';
  ctx.lineWidth = 2 * b;
  shape(ctx, r, bubble, dir, sh, sh);
  ctx.fillStyle = SHADOW;
  ctx.strokeStyle = SHADOW;
  ctx.fill();
  ctx.stroke();
  shape(ctx, r, bubble, dir);
  ctx.fillStyle = GLAZE;
  ctx.strokeStyle = GLAZE;
  ctx.fill();
  ctx.stroke();
}

function drawBackground(ctx: Ctx, f: Frame): void {
  const sc = sceneFor(ctx, f);
  ground(ctx, sc);
  const l = L(f.mode, f.aspect);
  if (l.scr) frame(ctx, l.scr, false, l.dir);
  if (l.bubble && l.cam) {
    frame(ctx, l.bubble, true, 'bl');
    fillR(ctx, l.cam, CAM_TONE);
  }
}

// ---------------------------------------------------------------------------------------------

function drawLabel(ctx: Ctx, sc: Scene, key: LabelKey, x: number, y: number, size: number): void {
  const min = minText(sc);
  if (key === 'mode') {
    setFont(ctx, F_LABEL, size - 4);
    text(ctx, sc.durationText, x, y, GLAZE, 'right');
    const wa = measure(ctx, sc.durationText);
    diamond(ctx, x - wa - 20, y - size * 0.3, 7, CORAL);
    text(ctx, sc.modeName, x - wa - 40, y, GLAZE, 'right');
    return;
  }
  if (key === 'done') {
    setFont(ctx, F_DONE, size + 6);
    const dot = measure(ctx, '.');
    text(ctx, '.', x, y, CORAL, 'right');
    text(ctx, sc.str.timeUp, x - dot, y, GLAZE, 'right');
    return;
  }
  const name = key === 'research' ? sc.str.research : sc.str.steps[key === 's0' ? 0 : key === 's1' ? 1 : 2];
  setFont(ctx, F_LABEL, size);
  const w = measure(ctx, name);
  text(ctx, name, x, y, GLAZE, 'right');
  let left = x - w - 16;
  if (key !== 'research') {
    setFont(ctx, F_NUM, min);
    const nn = NUMS[key === 's0' ? 0 : key === 's1' ? 1 : 2];
    text(ctx, nn, left, y - 2, GLAZE_60, 'right');
    left -= measure(ctx, nn) + 18;
  } else {
    left -= 2;
  }
  diamond(ctx, left, y - size * 0.3, 8, CORAL);
}

function labelSlot(ctx: Ctx, sc: Scene, l: BL): void {
  const [x, y, size] = l.label;
  if (sc.labelPrev) {
    ctx.globalAlpha = 1 - sc.labelK;
    drawLabel(ctx, sc, sc.labelPrev, x, y - 16 * sc.labelK, size);
  }
  ctx.globalAlpha = sc.labelK;
  drawLabel(ctx, sc, sc.label, x, y + 16 * (1 - sc.labelK), size);
  ctx.globalAlpha = 1;
}

function hopY(tSec: number, i: number): number {
  const p = ((((tSec - i * 0.16) / 0.48) % 1) + 1) % 1;
  if (p < 0.3) return eOut(p / 0.3);
  if (p < 0.6) return 1 - eOut((p - 0.3) / 0.3);
  return 0;
}

function drawTopic(ctx: Ctx, sc: Scene, kind: TopicKind, topic: string | null, x: number, y: number, w: number, size: number): void {
  const min = sc.wide ? 34 : 36;
  if (kind === 'topic' && topic) {
    const f = fit(ctx, topic, F_TOPIC, w - 20, 1, size, min);
    const line = f.lines[0] ?? '';
    text(ctx, line, x, y, GLAZE);
    text(ctx, '.', x + measure(ctx, line), y, CORAL);
    return;
  }
  // "konu ◆ ▁▁▁" — the slot is there, waiting; while the wheel spins its diamonds hop instead.
  const small = Math.max(minText(sc), Math.round(size * 0.7));
  setFont(ctx, F_LABEL, small);
  text(ctx, sc.str.topic, x, y, GLAZE_60);
  let cx = x + measure(ctx, sc.str.topic) + 28;
  const cy = y - small * 0.32;
  if (kind === 'spin') {
    for (let i = 0; i < 3; i += 1) {
      const h = hopY(sc.tSec, i);
      diamond(ctx, cx + i * 30, cy - 10 * h, 9, h > 0.5 ? CORAL : GLAZE);
    }
    setFont(ctx, F_STEP_DIM, small);
    text(ctx, sc.str.drawing, cx + 3 * 30 + 12, y, GLAZE_60);
    return;
  }
  diamond(ctx, cx, cy, 8, CORAL);
  cx += 26;
  fill(ctx, cx, y - 6, Math.min(w * 0.4, 420), 6, GLAZE_22);
}

function topicSlot(ctx: Ctx, sc: Scene, l: BL): void {
  const [x, y, w, size] = l.topic;
  if (sc.topicPrevKind) {
    const a = 1 - clamp(sc.topicK * 2);
    if (a > 0) {
      ctx.globalAlpha = a;
      drawTopic(ctx, sc, sc.topicPrevKind, sc.topicPrevText, x, y, w, size);
    }
  }
  ctx.globalAlpha = sc.topicK;
  drawTopic(ctx, sc, sc.topicKind, sc.topicText, x, y + 12 * (1 - sc.topicK), w, size);
  ctx.globalAlpha = 1;
}

/** 12 diamonds — the logo's tile marks — filling one by one. */
function beads(ctx: Ctx, sc: Scene, l: BL): void {
  const [x, y, pitch, r] = l.beads;
  for (let i = 0; i < 12; i += 1) {
    const cx = x + i * pitch + r;
    diamond(ctx, cx, y, r, GLAZE_22);
    const f = clamp(sc.progress * 12 - i);
    if (f > 0) {
      ctx.globalAlpha = f;
      diamond(ctx, cx, y, r, sc.timeUp ? CORAL : GLAZE);
      ctx.globalAlpha = 1;
    }
  }
}

function stepColor(sc: Scene, i: number): string {
  return (sc.running || sc.timeUp) && i <= sc.arc ? DEEP : DEEP_45;
}

/** The timer tile: a piece cut from the site's timer screen. */
function tile(ctx: Ctx, sc: Scene, r: Rect, alpha: number): void {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  frame(ctx, r, false, 'bl');
  const { x, y, w, h } = r;
  const pad = Math.round(Math.min(w, 700) * 0.07);
  const clockColor = sc.timeUp ? CORAL : sc.running ? DEEP : DEEP_45;
  const min = minText(sc);
  if (sc.wide) {
    const ds = fitSize(ctx, '00:00', F_DIGITS, w - pad * 2, 150);
    setFont(ctx, F_DIGITS, ds);
    const base = y + pad + ds * 0.78;
    text(ctx, sc.clockText, x + pad - 6, base, clockColor);
    ruler(ctx, x + pad, x + w - pad, base + 40, sc.progress, RULER, 12, 6);
    // The outline as a short list under the ruler.
    let yy = base + 40 + 52;
    for (let i = 0; i < 3; i += 1) {
      setFont(ctx, (sc.running || sc.timeUp) && i <= sc.arc ? F_STEP : F_STEP_DIM, min);
      const s = sc.str.steps[i];
      text(ctx, s, x + pad, yy, stepColor(sc, i));
      if (sc.running && i === sc.arc) fill(ctx, x + pad, yy + 7, measure(ctx, s), 3, CORAL);
      yy += min + 12;
    }
  } else {
    const ds = Math.min(150, fitSize(ctx, '00:00', F_DIGITS, w * 0.52, 150));
    setFont(ctx, F_DIGITS, ds);
    text(ctx, sc.clockText, x + pad - 6, y + (h - pad) / 2 + ds * 0.36, clockColor);
    let yy = y + pad + 30;
    const stepSize = Math.max(min, 30);
    for (let i = 0; i < 3; i += 1) {
      setFont(ctx, (sc.running || sc.timeUp) && i <= sc.arc ? F_STEP : F_STEP_DIM, stepSize);
      const s = sc.str.steps[i];
      text(ctx, s, x + w - pad, yy, stepColor(sc, i), 'right');
      if (sc.running && i === sc.arc) {
        const sw = measure(ctx, s);
        fill(ctx, x + w - pad - sw, yy + 8, sw, 3, CORAL);
      }
      yy += stepSize + 22;
    }
    ruler(ctx, x + pad, x + w - pad, y + h - pad + 6, sc.progress, RULER, 12, 6);
  }
  ctx.globalAlpha = 1;
}

/** The closing card: a second bubble "answering" the camera. */
function endCard(ctx: Ctx, sc: Scene, l: BL): void {
  const e = sc.end;
  const r = l.end;
  const inA = eOut(e / 0.5);
  if (l.endIsScreen) {
    // The screen gives way: the ground closes over it (and its frame and shadow).
    const { b, sh } = edge(r);
    ctx.globalAlpha = inA;
    ground(ctx, sc, r.x - b - 1, r.y - b - 1, r.w + 2 * b + sh + 2, r.h + 2 * b + sh + 2);
    ctx.globalAlpha = 1;
  }
  const up = (1 - eOut(e)) * 40;
  const rr = rect(r.x, r.y + up, r.w, r.h);
  ctx.globalAlpha = inA;
  frame(ctx, rr, true, l.dir);
  const a = eOut((e - 0.3) / 0.7) * inA;
  if (a > 0) {
    ctx.globalAlpha = a;
    const t = tailOf(rr.h).t;
    const pad = rr.w * 0.08;
    const w = rr.w - pad * 2;
    const big = Math.min(sc.wide ? 150 : 120, w / 5.4);
    const cy = rr.y + (rr.h - t) / 2;
    const x = rr.x + pad;
    drawLogo(ctx, x, cy - big * 0.3, big, END_LOGO, 'ready', sc.levels, sc.tSec, sc.str.wordmark);
    const tagSize = Math.max(minText(sc), Math.min(big * 0.44, fitSize(ctx, `${sc.str.tagline}.`, F_TAG, w, big * 0.44)));
    setFont(ctx, F_TAG, tagSize);
    const ty = cy + big * 0.58;
    text(ctx, sc.str.tagline, x, ty, DEEP);
    text(ctx, '.', x + measure(ctx, sc.str.tagline), ty, CORAL);
    setFont(ctx, F_ADDR, Math.max(minText(sc), Math.min(big * 0.3, fitSize(ctx, sc.str.address, F_ADDR, w, big * 0.3))));
    const ay = ty + Math.max(tagSize * 1.25, big * 0.52);
    text(ctx, sc.str.address, x, ay, COB);
    fill(ctx, x, ay + 8, measure(ctx, sc.str.address), 3, CORAL);
  }
  ctx.globalAlpha = 1;
}

function drawOverlays(ctx: Ctx, f: Frame): void {
  const sc = sceneFor(ctx, f);
  const l = L(f.mode, f.aspect);
  if (l.tile) tile(ctx, sc, l.tile, 1 - eOut(sc.end / 0.5));
  const [lx, ly, ls] = l.logo;
  drawLogo(ctx, lx, ly, ls, LOGO, sc.logo, sc.levels, sc.tSec, sc.str.wordmark);
  labelSlot(ctx, sc, l);
  topicSlot(ctx, sc, l);
  beads(ctx, sc, l);
  if (sc.end > 0) endCard(ctx, sc, l);
}

export const balon: StyleDefinition = {
  id: 'balon',
  labelKey: 'balon',
  aspects: ['wide', 'tall'],
  fonts: ['Figtree:500,600,700,800', 'Newsreader:500,600'],
  layout,
  drawBackground,
  drawOverlays,
};
