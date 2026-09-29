import type { CompositeLayout, CompositeMode, CompositeSources, Frame, Rect, RecordAspect, Size, StyleDefinition } from '../types';
import {
  TALL_SAFE,
  clamp,
  drawLogo,
  eOut,
  fill,
  fillR,
  fit,
  fitSize,
  fontSpec,
  lerp,
  measure,
  minText,
  rect,
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
 * ızgara — a poster: thick black lines splitting the canvas into cells, flat red/blue/yellow blocks.
 * Camera and screen sit in their own cells and never move; when the outline step changes, the colour
 * blocks rebuild (new colour wipes over the old, never blending) and the step cell resizes. The timer
 * is the step cell itself filling with yellow; at time up it carries a huge "süre." stamp. Before a
 * topic lands the topic cell shows "konu ▬" and while the wheel spins three yellow squares hop.
 * At the end a blue cell drops into the screen (or timer) cell. In portrait the grid bleeds to the
 * edges on purpose; text stays inside the safe area.
 */

const LINE = '#111111';
const CELL = '#f5f3ee';
const RED = '#d93a26';
const BLUE = '#1f3d94';
const YEL = '#f1c21b';
const INK = '#111111';
const INK_40 = 'rgba(17,17,17,0.4)';
const CAM_TONE = '#3a3834';
const SCR_TONE = '#e9e6de';
const G = 12;

const BIG = "'Big Shoulders Display', 'Arial Narrow', sans-serif";
const SANS = "'Instrument Sans', system-ui, sans-serif";
const F_BIG = fontSpec(900, BIG, 'normal', -0.01);
const F_WORD = fontSpec(700, SANS);
const F_BOLD = fontSpec(700, SANS);
const F_MED = fontSpec(500, SANS);
const F_SEMI = fontSpec(600, SANS);
const F_TOPIC = fontSpec(700, SANS, 'normal', -0.01);

const LOGO: LogoColors = { bubble: CELL, mark: BLUE, accent: YEL, word: CELL, dot: YEL, font: F_WORD };
const NUMS = ['01', '02', '03'] as const;
/** Block colours per outline step: the grid is rebuilt at every step. */
const ROT = [
  [RED, YEL],
  [BLUE, RED],
  [RED, BLUE],
] as const;
/** Step-cell width as a share of its band, per outline step. */
const SPLIT_WIDE = [0.644, 0.47, 0.743] as const;
const SPLIT_TALL = [0.5, 0.37, 0.574] as const;

interface IL {
  readonly cam?: Rect;
  readonly scr?: Rect;
  /** Timer cell (camera-only): topic + big clock. */
  readonly timer?: Rect;
  /** Topic strip (both). */
  readonly topicCell?: Rect;
  /** Big topic cell (screen-only). */
  readonly bigTopic?: Rect;
  /** Clock cell (screen-only). */
  readonly clockCell?: Rect;
  /** Band the step cell shares with a colour block — horizontal (wide) or the top band (tall). */
  readonly band: Rect;
  /** Static brand cell (wide); in tall the brand cell is the left part of the top band. */
  readonly brand?: Rect;
  /** Vertical colour block beside the screen/timer (tall). */
  readonly sideA?: Rect;
  /** Second colour block. */
  readonly blockB?: Rect;
  readonly blockBVertical: boolean;
  readonly end: Rect;
  readonly logo: readonly [number, number, number];
}

function build(mode: CompositeMode, aspect: RecordAspect): IL {
  if (aspect === 'wide') {
    if (mode === 'both') {
      const scr = rect(1112, 0, 808, 454);
      return { cam: rect(0, 0, 1100, 1080), scr, topicCell: rect(1112, 466, 808, 190), band: rect(1112, 668, 808, 280),
        brand: rect(1112, 960, 420, 120), blockB: rect(1544, 960, 376, 120), blockBVertical: false, end: scr, logo: [1142, 1036, 38] };
    }
    if (mode === 'camera') {
      const timer = rect(1112, 0, 808, 656);
      return { cam: rect(0, 0, 1100, 1080), timer, band: rect(1112, 668, 808, 280), brand: rect(1112, 960, 420, 120),
        blockB: rect(1544, 960, 376, 120), blockBVertical: false, end: timer, logo: [1142, 1036, 38] };
    }
    const scr = rect(0, 0, 1440, 810);
    return { scr, bigTopic: rect(1452, 0, 468, 560), clockCell: rect(1452, 572, 468, 238), band: rect(0, 822, 1440, 258),
      brand: rect(1452, 822, 468, 258), blockBVertical: false, end: scr, logo: [1484, 966, 42] };
  }
  const top = { band: rect(0, 0, 1080, 250), sideA: rect(0, 262, 108, 540), logo: [120, 196, 38] } as const;
  if (mode === 'both') {
    const scr = rect(120, 262, 960, 540);
    return { ...top, scr, topicCell: rect(0, 814, 1080, 150), cam: rect(0, 976, 1080, 944), blockBVertical: false, end: scr };
  }
  if (mode === 'camera') {
    const timer = rect(120, 262, 960, 540);
    return { ...top, timer, cam: rect(0, 814, 1080, 1106), blockBVertical: false, end: timer };
  }
  const scr = rect(120, 262, 960, 540);
  return { ...top, scr, bigTopic: rect(0, 814, 1080, 400), blockB: rect(0, 1226, 108, 694), blockBVertical: true,
    clockCell: rect(120, 1226, 960, 694), end: scr };
}

const layouts = new Map<string, IL>();
function L(mode: CompositeMode, aspect: RecordAspect): IL {
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

function drawBackground(ctx: Ctx, f: Frame): void {
  const sc = sceneFor(ctx, f);
  fill(ctx, 0, 0, sc.W, sc.H, LINE);
  const l = L(f.mode, f.aspect);
  if (l.cam) fillR(ctx, l.cam, CAM_TONE);
  if (l.scr) fillR(ctx, l.scr, SCR_TONE);
}

// ---------------------------------------------------------------------------------------------

/** Right edge text may reach inside `r` (portrait keeps to the safe area). */
function rightEdge(sc: Scene, r: Rect, pad: number): number {
  return sc.wide ? r.x + r.w - pad : Math.min(TALL_SAFE.x1, r.x + r.w - pad);
}
function leftEdge(sc: Scene, r: Rect, pad: number): number {
  return sc.wide ? r.x + pad : Math.max(TALL_SAFE.x0, r.x + pad);
}

function clip(ctx: Ctx, r: Rect): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
}

/** A colour block: the previous colour, and the new one wiping over it (never blended). */
function block(ctx: Ctx, r: Rect, prev: string, cur: string, k: number, vertical: boolean): void {
  fillR(ctx, r, prev);
  if (prev === cur || k >= 1) {
    if (k >= 1) fillR(ctx, r, cur);
    return;
  }
  if (vertical) fill(ctx, r.x, r.y + r.h * (1 - k), r.w, r.h * k, cur);
  else fill(ctx, r.x, r.y, r.w * k, r.h, cur);
}

function drawStepLabel(ctx: Ctx, sc: Scene, key: LabelKey, r: Rect, dy: number): void {
  const { x, y, w, h } = r;
  const nx = leftEdge(sc, r, sc.wide ? 28 : 26);
  const right = rightEdge(sc, r, 20);
  const min = minText(sc);
  if (key === 'mode') {
    const size = Math.max(min, Math.min(44, fitSize(ctx, sc.modeName, F_BOLD, right - nx, 44)));
    setFont(ctx, F_BOLD, size);
    const y1 = sc.wide ? y + h * 0.46 : y + h - 34 - size * 1.25;
    text(ctx, sc.modeName, nx, y1 + dy, INK);
    setFont(ctx, F_MED, size);
    text(ctx, sc.durationText, nx, y1 + size * 1.25 + dy, INK);
    return;
  }
  if (key === 'done') {
    const size = Math.min(sc.wide ? 150 : 110, h * 0.6, fitSize(ctx, `${sc.str.timeUp}.`, F_BIG, right - nx, 150));
    setFont(ctx, F_BIG, size);
    const by = y + h - (sc.wide ? 40 : 34) + dy;
    text(ctx, sc.str.timeUp, nx, by, INK);
    text(ctx, '.', nx + measure(ctx, sc.str.timeUp), by, RED);
    return;
  }
  if (key === 'research') {
    const size = Math.min(sc.wide ? 150 : 110, h * 0.6, fitSize(ctx, sc.str.research, F_BIG, right - nx, 150));
    setFont(ctx, F_BIG, size);
    text(ctx, sc.str.research, nx, y + h - (sc.wide ? 40 : 34) + dy, INK);
    return;
  }
  const i = key === 's0' ? 0 : key === 's1' ? 1 : 2;
  const name = sc.str.steps[i];
  if (sc.wide) {
    // name on top, huge number below
    const f = fit(ctx, name, F_BOLD, right - nx, 2, 38, min);
    for (let j = 0; j < f.lines.length; j += 1) text(ctx, f.lines[j], nx, y + 62 + j * f.size * 1.16 + dy, INK);
    setFont(ctx, F_BIG, Math.min(190, h * 0.66));
    text(ctx, NUMS[i], nx, y + h - 30 + dy, INK);
    return;
  }
  // portrait: number and name side by side, sitting on the cell's floor
  setFont(ctx, F_BIG, 120);
  text(ctx, NUMS[i], nx, y + h - 34 + dy, INK);
  const nw = measure(ctx, NUMS[i]);
  const f = fit(ctx, name, F_BOLD, right - (nx + nw + 18), 2, 40, min);
  const lines = f.lines.length;
  for (let j = 0; j < lines; j += 1) {
    text(ctx, f.lines[j], nx + nw + 18, y + h - 44 - (lines - 1 - j) * f.size * 1.08 + dy, INK);
  }
}

/** The step cell: fills with yellow as time runs; its label slides in from below. */
function stepCell(ctx: Ctx, sc: Scene, r: Rect): void {
  fillR(ctx, r, CELL);
  fill(ctx, r.x, r.y, r.w * sc.progress, r.h, YEL);
  clip(ctx, r);
  if (sc.labelPrev) drawStepLabel(ctx, sc, sc.labelPrev, r, -r.h * sc.labelK);
  drawStepLabel(ctx, sc, sc.label, r, r.h * (1 - sc.labelK));
  ctx.restore();
}

function hopY(tSec: number, i: number): number {
  const p = ((((tSec - i * 0.16) / 0.48) % 1) + 1) % 1;
  if (p < 0.3) return eOut(p / 0.3);
  if (p < 0.6) return 1 - eOut((p - 0.3) / 0.3);
  return 0;
}

/** Topic (or its placeholder) with the first baseline at `y`. `anchorBottom` stacks lines upwards. */
function drawTopic(ctx: Ctx, sc: Scene, kind: TopicKind, topic: string | null, x: number, y: number, w: number, lines: number, size: number, anchorBottom: boolean, prefix: boolean): void {
  if (kind === 'topic' && topic) {
    const f = fit(ctx, topic, F_TOPIC, w, lines, size, sc.wide ? 34 : 36);
    const lh = f.size * 1.04;
    let yy = anchorBottom ? y - (f.lines.length - 1) * lh : y;
    for (const line of f.lines) {
      text(ctx, line, x, yy, INK);
      yy += lh;
    }
    return;
  }
  const min = minText(sc);
  setFont(ctx, F_SEMI, min);
  let bx = x;
  if (prefix) {
    text(ctx, sc.str.topic, x, y, INK);
    bx += measure(ctx, sc.str.topic) + 20;
  }
  if (kind === 'spin') {
    for (let i = 0; i < 3; i += 1) {
      const hgt = hopY(sc.tSec, i);
      fill(ctx, bx + i * 34, y - 24 - 12 * hgt, 22, 22, hgt > 0.5 ? RED : YEL);
    }
    setFont(ctx, F_MED, min);
    text(ctx, sc.str.drawing, bx + 3 * 34 + 10, y, INK);
    return;
  }
  fill(ctx, bx, y - 14, Math.min(w * 0.45, 380), 14, INK);
}

function topicSlot(ctx: Ctx, sc: Scene, x: number, y: number, w: number, lines: number, size: number, anchorBottom = false, prefix = true): void {
  if (sc.topicPrevKind) {
    const a = 1 - clamp(sc.topicK * 2);
    if (a > 0) {
      ctx.globalAlpha = a;
      drawTopic(ctx, sc, sc.topicPrevKind, sc.topicPrevText, x, y, w, lines, size, anchorBottom, prefix);
    }
  }
  ctx.globalAlpha = sc.topicK;
  drawTopic(ctx, sc, sc.topicKind, sc.topicText, x, y + 10 * (1 - sc.topicK), w, lines, size, anchorBottom, prefix);
  ctx.globalAlpha = 1;
}

function clockColor(sc: Scene): string {
  return sc.timeUp ? RED : sc.running ? INK : INK_40;
}

/** Camera-only: topic on top, huge clock at the bottom. */
function timerCell(ctx: Ctx, sc: Scene, r: Rect): void {
  fillR(ctx, r, CELL);
  const pad = sc.wide ? 34 : 30;
  const x = leftEdge(sc, r, pad);
  const right = rightEdge(sc, r, pad);
  topicSlot(ctx, sc, x, r.y + pad + 56, right - x, 2, 56);
  const ds = fitSize(ctx, '00:00', F_BIG, right - x + 8, sc.wide ? 300 : 330);
  setFont(ctx, F_BIG, ds);
  text(ctx, sc.clockText, x - 8, r.y + r.h - pad + 6, clockColor(sc));
}

function topicCell(ctx: Ctx, sc: Scene, r: Rect): void {
  fillR(ctx, r, CELL);
  const x = leftEdge(sc, r, 34);
  const right = rightEdge(sc, r, 34);
  const size = sc.wide ? 50 : 52;
  // centred vertically for one line; two lines grow around the centre
  const f = sc.topicKind === 'topic' && sc.topicText ? fit(ctx, sc.topicText, F_TOPIC, right - x, 2, size, sc.wide ? 34 : 36) : null;
  const n = f ? f.lines.length : 1;
  const s = f ? f.size : size;
  const y = r.y + r.h / 2 + s * 0.35 - ((n - 1) * s * 1.04) / 2;
  topicSlot(ctx, sc, x, y, right - x, 2, size);
}

function bigTopicCell(ctx: Ctx, sc: Scene, r: Rect): void {
  fillR(ctx, r, CELL);
  const x = leftEdge(sc, r, 34);
  const right = rightEdge(sc, r, 34);
  setFont(ctx, F_SEMI, minText(sc));
  text(ctx, sc.str.topic, x, r.y + 66, INK);
  topicSlot(ctx, sc, x, r.y + r.h - 40, right - x, sc.wide ? 4 : 3, 96, true, false);
}

function clockCell(ctx: Ctx, sc: Scene, r: Rect): void {
  fillR(ctx, r, CELL);
  const pad = 34;
  const x = leftEdge(sc, r, pad);
  const right = rightEdge(sc, r, pad);
  const bottom = sc.wide ? r.y + r.h - pad + 6 : Math.min(TALL_SAFE.y1 - 20, r.y + r.h - pad);
  const ds = Math.min(fitSize(ctx, '00:00', F_BIG, right - x + 8, sc.wide ? 200 : 330), (bottom - r.y - pad) * 1.15);
  setFont(ctx, F_BIG, ds);
  text(ctx, sc.clockText, x - 6, bottom, clockColor(sc));
}

function endCell(ctx: Ctx, sc: Scene, r: Rect): void {
  const e = sc.end;
  fill(ctx, r.x, r.y, r.w, r.h * eOut(e), BLUE);
  const a = eOut((e - 0.35) / 0.65);
  if (a <= 0) return;
  clip(ctx, r);
  ctx.globalAlpha = a;
  const pad = 40;
  const x = leftEdge(sc, r, pad);
  const right = rightEdge(sc, r, pad);
  const large = r.w > 1200;
  const logoSize = large ? 120 : sc.wide ? 76 : 78;
  const base = r.y + r.h * 0.42;
  drawLogo(ctx, x, base, logoSize, LOGO, 'ready', sc.levels, sc.tSec, sc.str.wordmark);
  const f = fit(ctx, `${sc.str.tagline}.`, F_BOLD, right - x, 2, large ? 64 : 44, minText(sc));
  for (let i = 0; i < f.lines.length; i += 1) text(ctx, f.lines[i], x, base + logoSize * 1.05 + i * f.size * 1.18, CELL);
  setFont(ctx, F_SEMI, Math.max(minText(sc), Math.min(34, fitSize(ctx, sc.str.address, F_SEMI, right - x, 34))));
  text(ctx, sc.str.address, x, r.y + r.h - pad, YEL);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawOverlays(ctx: Ctx, f: Frame): void {
  const sc = sceneFor(ctx, f);
  const l = L(f.mode, f.aspect);

  if (l.timer) timerCell(ctx, sc, l.timer);
  if (l.topicCell) topicCell(ctx, sc, l.topicCell);
  if (l.bigTopic) bigTopicCell(ctx, sc, l.bigTopic);
  if (l.clockCell) clockCell(ctx, sc, l.clockCell);

  // The band: step cell + colour block, rebuilt at every outline step.
  const fr = sc.wide ? SPLIT_WIDE : SPLIT_TALL;
  const band = l.band;
  const split = Math.round(band.w * lerp(fr[sc.arcPrev], fr[sc.arc], sc.arcK));
  const cPrev = ROT[sc.arcPrev];
  const cCur = ROT[sc.arc];
  if (sc.wide) {
    stepCell(ctx, sc, rect(band.x, band.y, split, band.h));
    block(ctx, rect(band.x + split + G, band.y, band.w - split - G, band.h), cPrev[0], cCur[0], sc.arcK, false);
    if (l.blockB) block(ctx, l.blockB, cPrev[1], cCur[1], sc.arcK, l.blockBVertical);
    if (l.brand) {
      fillR(ctx, l.brand, BLUE);
    }
  } else {
    fill(ctx, band.x, band.y, split, band.h, BLUE); // brand cell
    stepCell(ctx, sc, rect(band.x + split + G, band.y, band.w - split - G, band.h));
    if (l.sideA) block(ctx, l.sideA, cPrev[0], cCur[0], sc.arcK, true);
    if (l.blockB) block(ctx, l.blockB, cPrev[1], cCur[1], sc.arcK, l.blockBVertical);
  }
  const [lx, ly, ls] = l.logo;
  drawLogo(ctx, lx, ly, ls, LOGO, sc.logo, sc.levels, sc.tSec, sc.str.wordmark);

  if (sc.end > 0) endCell(ctx, sc, l.end);
}

export const izgara: StyleDefinition = {
  id: 'izgara',
  labelKey: 'izgara',
  aspects: ['wide', 'tall'],
  fonts: ['Big Shoulders Display:700,900', 'Instrument Sans:500,600,700'],
  layout,
  drawBackground,
  drawOverlays,
};
