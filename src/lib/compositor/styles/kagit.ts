import type { CompositeLayout, CompositeMode, CompositeSources, Frame, Rect, RecordAspect, Size, StyleDefinition } from '../types';
import {
  clamp,
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
 * kâğıt — the site itself ("F — Kâğıt"): paper, ink, one red accent, Newsreader. No boxes, shadows or
 * rounded corners. The header rule under the logo doubles as the timer (a 12-tick ink ruler); the
 * topic is written on the paper like a caption ("konu" + the words), and before a topic has landed
 * that caption is an empty line waiting to be filled. At the end a fresh sheet rises in place of the
 * screen (or the timer column) carrying the logo, "konu gelir, söz sende." and the address.
 */

const PAPER = '#f3eee2';
const INK = '#1d1a16';
const PENCIL = '#6f695c';
const RULE = '#d6cfbf';
const BLANK = '#b3aa96';
const RED = '#b8281c';
const CAM_TONE = '#dcd4c3';
const SCR_TONE = '#e7e1d3';

const SER = 'Newsreader, Georgia, serif';
const F_WORD = fontSpec(600, SER);
const F_LABEL = fontSpec(600, SER);
const F_NUM = fontSpec(500, SER);
const F_ITALIC = fontSpec(400, SER, 'italic');
const F_TOPIC = fontSpec(700, SER, 'normal', -0.02);
const F_CAPTION = fontSpec(600, SER, 'normal', -0.01);
const F_DIGITS = fontSpec(500, SER, 'normal', -0.04);
const F_TAG = fontSpec(600, SER);
const F_ADDR = fontSpec(400, SER);

const LOGO: LogoColors = { bubble: INK, mark: PAPER, accent: RED, word: INK, dot: RED, font: F_WORD };
const NUMS = ['01', '02', '03'] as const;
const RULER = { base: RULE, tick: PENCIL, bar: INK } as const;
const DOTS = ['', '.', '..', '...'] as const;

interface KL {
  readonly cam?: Rect;
  readonly scr?: Rect;
  /** Topic caption under the screen (screen layouts). */
  readonly cap?: Rect;
  readonly capLines: number;
  readonly capSize: number;
  /** Written timer column: topic + big digits (camera-only and screen-only layouts). */
  readonly col?: Rect;
  readonly colLines: number;
  readonly colSize: number;
  readonly colClock: number;
  /** Where the closing sheet rises. */
  readonly end: Rect;
  readonly logo: readonly [number, number, number];
  readonly label: readonly [number, number, number];
  readonly ruler: readonly [number, number, number];
}

function build(mode: CompositeMode, aspect: RecordAspect): KL {
  if (aspect === 'wide') {
    const head = { logo: [64, 90, 40], label: [1856, 90, 36], ruler: [64, 1856, 128] } as const;
    if (mode === 'both') {
      return { ...head, scr: rect(64, 164, 1100, 619), cap: rect(64, 812, 1100, 204), capLines: 2, capSize: 64, cam: rect(1196, 164, 660, 852),
        colLines: 0, colSize: 0, colClock: 0, end: rect(64, 164, 1100, 852) };
    }
    if (mode === 'camera') {
      return { ...head, col: rect(64, 164, 640, 852), colLines: 3, colSize: 88, colClock: 230, cam: rect(736, 164, 1120, 852),
        capLines: 0, capSize: 0, end: rect(64, 164, 640, 852) };
    }
    return { ...head, scr: rect(64, 164, 1360, 765), col: rect(1464, 164, 392, 852), colLines: 4, colSize: 64, colClock: 170,
      capLines: 0, capSize: 0, end: rect(64, 164, 1792, 852) };
  }
  const head = { logo: [120, 196, 40], label: [960, 196, 40], ruler: [120, 960, 236] } as const;
  if (mode === 'both') {
    return { ...head, scr: rect(120, 272, 840, 472), cap: rect(120, 764, 840, 136), capLines: 1, capSize: 60, cam: rect(120, 914, 840, 746),
      colLines: 0, colSize: 0, colClock: 0, end: rect(120, 272, 840, 628) };
  }
  if (mode === 'camera') {
    return { ...head, col: rect(120, 272, 840, 452), colLines: 2, colSize: 76, colClock: 220, cam: rect(120, 756, 840, 904),
      capLines: 0, capSize: 0, end: rect(120, 272, 840, 452) };
  }
  return { ...head, scr: rect(120, 272, 840, 472), col: rect(120, 784, 840, 640), colLines: 3, colSize: 88, colClock: 280,
    capLines: 0, capSize: 0, end: rect(120, 272, 840, 1152) };
}

const layouts = new Map<string, KL>();
function L(mode: CompositeMode, aspect: RecordAspect): KL {
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

function drawBackground(ctx: Ctx, frame: Frame): void {
  const sc = sceneFor(ctx, frame);
  fill(ctx, 0, 0, sc.W, sc.H, PAPER);
  const l = L(frame.mode, frame.aspect);
  if (l.scr) {
    fill(ctx, l.scr.x - 2, l.scr.y - 2, l.scr.w + 4, l.scr.h + 4, RULE);
    fillR(ctx, l.scr, SCR_TONE);
  }
  if (l.cam) fillR(ctx, l.cam, CAM_TONE);
}

// ---------------------------------------------------------------------------------------------

function drawLabel(ctx: Ctx, sc: Scene, key: LabelKey, x: number, y: number, size: number): void {
  if (key === 'mode') {
    setFont(ctx, F_ITALIC, size);
    text(ctx, sc.durationText, x, y, PENCIL, 'right');
    let right = x - measure(ctx, sc.durationText);
    text(ctx, ' · ', right, y, PENCIL, 'right');
    right -= measure(ctx, ' · ');
    text(ctx, sc.modeName, right, y, PENCIL, 'right');
    return;
  }
  if (key === 'done') {
    setFont(ctx, F_LABEL, size + 4);
    const dot = measure(ctx, '.');
    text(ctx, sc.str.timeUp, x - dot, y, INK, 'right');
    text(ctx, '.', x, y, RED, 'right');
    return;
  }
  const name = key === 'research' ? sc.str.research : sc.str.steps[key === 's0' ? 0 : key === 's1' ? 1 : 2];
  setFont(ctx, F_LABEL, size);
  const w = measure(ctx, name);
  text(ctx, name, x, y, INK, 'right');
  fill(ctx, x - w, y + 8, w, 3, key === 'research' ? PENCIL : RED);
  if (key !== 'research') {
    setFont(ctx, F_NUM, Math.max(minText(sc), size * 0.8));
    text(ctx, NUMS[key === 's0' ? 0 : key === 's1' ? 1 : 2], x - w - 16, y, PENCIL, 'right');
  }
}

function labelSlot(ctx: Ctx, sc: Scene, l: KL): void {
  const [x, y, size] = l.label;
  if (sc.labelPrev) {
    ctx.globalAlpha = 1 - sc.labelK;
    drawLabel(ctx, sc, sc.labelPrev, x, y - 16 * sc.labelK, size);
  }
  ctx.globalAlpha = sc.labelK;
  drawLabel(ctx, sc, sc.label, x, y + 16 * (1 - sc.labelK), size);
  ctx.globalAlpha = 1;
}

/** One state of the topic slot, first baseline at `y`. */
function drawTopic(ctx: Ctx, sc: Scene, kind: TopicKind, topic: string | null, x: number, y: number, w: number, lines: number, size: number, min: number): void {
  if (kind === 'topic' && topic) {
    const f = fit(ctx, topic, F_TOPIC, w - 16, lines, size, min);
    let yy = y;
    for (let i = 0; i < f.lines.length; i += 1) {
      text(ctx, f.lines[i], x, yy, INK);
      if (i === f.lines.length - 1) text(ctx, '.', x + measure(ctx, f.lines[i]), yy, RED);
      yy += f.size * 0.98;
    }
    return;
  }
  // An empty line on the paper, waiting for the topic; while the wheel spins a stroke of ink runs
  // along it.
  const lineW = Math.min(w, Math.max(260, w * 0.62));
  fill(ctx, x, y + 6, lineW, 3, BLANK);
  if (kind === 'spin') {
    const seg = lineW * 0.24;
    const p = 0.5 + 0.5 * Math.sin(sc.tSec * 3.6);
    fill(ctx, x + (lineW - seg) * p, y + 5, seg, 5, INK);
    setFont(ctx, F_ITALIC, Math.max(minText(sc), size * 0.5));
    text(ctx, sc.str.drawing, x, y - size * 0.12, PENCIL);
    const dots = DOTS[Math.floor(sc.tSec * 2.5) % 4];
    if (dots) text(ctx, dots, x + measure(ctx, sc.str.drawing), y - size * 0.12, PENCIL);
  }
}

function topicSlot(ctx: Ctx, sc: Scene, x: number, y: number, w: number, lines: number, size: number, min: number): void {
  if (sc.topicPrevKind) {
    const a = 1 - clamp(sc.topicK * 2);
    if (a > 0) {
      ctx.globalAlpha = a;
      drawTopic(ctx, sc, sc.topicPrevKind, sc.topicPrevText, x, y, w, lines, size, min);
    }
  }
  ctx.globalAlpha = sc.topicK;
  drawTopic(ctx, sc, sc.topicKind, sc.topicText, x, y + 12 * (1 - sc.topicK), w, lines, size, min);
  ctx.globalAlpha = 1;
}

/** The caption under the screen: "konu" in pencil, then the topic (or its blank line). */
function caption(ctx: Ctx, sc: Scene, r: Rect, lines: number, size: number): void {
  const labelSize = minText(sc);
  setFont(ctx, F_ITALIC, labelSize);
  text(ctx, sc.str.topic, r.x, r.y + labelSize, PENCIL);
  topicSlot(ctx, sc, r.x, r.y + labelSize + size * 1.05, r.w, lines, size, 40);
}

/** Camera-/screen-only: the timer written on the paper like the site's own timer screen. */
function column(ctx: Ctx, sc: Scene, l: KL, r: Rect): void {
  caption(ctx, sc, r, l.colLines, l.colSize);
  const size = fitSize(ctx, '00:00', F_DIGITS, r.w, l.colClock);
  setFont(ctx, F_DIGITS, size);
  text(ctx, sc.clockText, r.x - (sc.wide ? size * 0.03 : 0), r.y + r.h - 6, sc.running || sc.timeUp ? INK : PENCIL);
}

function endCard(ctx: Ctx, sc: Scene, r: Rect): void {
  const e = sc.end;
  const top = r.y - 3 + (r.h + 6) * (1 - e);
  fill(ctx, r.x - 3, top, r.w + 6, r.y + r.h + 3 - top, PAPER);
  const a = eOut((e - 0.62) / 0.38);
  if (a <= 0) return;
  const dy = 18 * (1 - a);
  const pad = r.w > 1200 ? r.w * 0.06 : sc.wide ? 0 : 8;
  const x = r.x + pad;
  const w = r.w - pad * 2;
  const big = Math.min(r.w > 1200 ? 140 : sc.wide ? 96 : 128, w / 6.6);
  const cy = r.y + r.h / 2;
  ctx.globalAlpha = a;
  drawLogo(ctx, x, cy - big * 0.35 + dy, big, LOGO, 'ready', sc.levels, sc.tSec, sc.str.wordmark);
  const tagSize = Math.min(big * 0.46, fitSize(ctx, `${sc.str.tagline}.`, F_TAG, w, big * 0.46));
  setFont(ctx, F_TAG, tagSize);
  const ty = cy + big * 0.55 + dy;
  text(ctx, sc.str.tagline, x, ty, INK);
  text(ctx, '.', x + measure(ctx, sc.str.tagline), ty, RED);
  setFont(ctx, F_ADDR, Math.max(minText(sc), big * 0.32));
  const ay = cy + big * 1.12 + dy;
  text(ctx, sc.str.address, x, ay, PENCIL);
  fill(ctx, x, ay + 8, measure(ctx, sc.str.address), 2, RULE);
  ctx.globalAlpha = 1;
}

function drawOverlays(ctx: Ctx, frame: Frame): void {
  const sc = sceneFor(ctx, frame);
  const l = L(frame.mode, frame.aspect);

  if (l.cap) caption(ctx, sc, l.cap, l.capLines, l.capSize);
  if (l.col) column(ctx, sc, l, l.col);

  const [lx, ly, ls] = l.logo;
  drawLogo(ctx, lx, ly, ls, LOGO, sc.logo, sc.levels, sc.tSec, sc.str.wordmark);
  labelSlot(ctx, sc, l);
  const [r0, r1, ry] = l.ruler;
  ruler(ctx, r0, r1, ry, sc.progress, RULER, 14, 6);

  if (sc.end > 0) endCard(ctx, sc, l.end);
}

export const kagit: StyleDefinition = {
  id: 'kagit',
  labelKey: 'kagit',
  aspects: ['wide', 'tall'],
  fonts: ['Newsreader:400,400i,500,600,700'],
  layout,
  drawBackground,
  drawOverlays,
};
