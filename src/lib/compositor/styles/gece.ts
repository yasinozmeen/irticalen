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
 * gece — a dark broadcast studio: near-black warm ground, thin-edged dark plates, one amber accent.
 * The label sits under the logo (amber number + step), a studio-monitor timecode top right
 * ("01:45 / 03:00"), a thin amber line filling along the bottom. Before a topic lands the topic slot
 * shows "konu" and a dim cursor bar; while the wheel spins an amber block scans along it. At the end
 * a dark plate lights up where the screen (or timer card) was, an amber line drawing across its top.
 */

const BG = '#141210';
const CARD = '#1c1814';
const EDGE = 'rgba(242,236,225,0.14)';
const TEXT = '#f2ece1';
const DIM = 'rgba(242,236,225,0.5)';
const FAINT = 'rgba(242,236,225,0.16)';
const AMBER = '#e7a33e';
const CAM_TONE = '#26211c';

const GRO = "'Space Grotesk', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const F_WORD = fontSpec(700, GRO, 'normal', -0.03);
const F_MONO = fontSpec(500, MONO, 'normal', 0.03);
const F_MONO_B = fontSpec(600, MONO);
const F_NAME = fontSpec(600, GRO);
const F_DONE = fontSpec(700, GRO);
const F_TOPIC = fontSpec(600, GRO, 'normal', -0.01);
const F_DIGITS = fontSpec(500, GRO, 'normal', -0.03);
const F_CODE = fontSpec(500, MONO);
const F_TAG = fontSpec(600, GRO);

const LOGO: LogoColors = { bubble: TEXT, mark: BG, accent: AMBER, word: TEXT, dot: AMBER, font: F_WORD };
const NUMS = ['01', '02', '03'] as const;
const SLASH = ' / ';

interface GL {
  readonly scr?: Rect;
  readonly cam?: Rect;
  /** Timer card (camera-only and screen-only). */
  readonly card?: Rect;
  readonly cardList: boolean;
  /** The card carries the topic too (screen-only, landscape). */
  readonly cardTopic: boolean;
  /** Topic block under the screen (both, landscape): x, label baseline, width, size, lines. */
  readonly block?: readonly [number, number, number, number, number];
  /** Single topic line: x, baseline, width, size. */
  readonly line?: readonly [number, number, number, number];
  readonly end: Rect;
  readonly logo: readonly [number, number, number];
  readonly label: readonly [number, number, number];
  readonly code: readonly [number, number, number];
  /** Progress line: x0, x1, y. */
  readonly bar: readonly [number, number, number];
}

function build(mode: CompositeMode, aspect: RecordAspect): GL {
  if (aspect === 'wide') {
    const head = { logo: [64, 76, 34], label: [64, 124, 34], code: [1856, 76, 34] } as const;
    if (mode === 'both') {
      return { ...head, scr: rect(64, 146, 1120, 630), cam: rect(1216, 146, 640, 796), block: [64, 830, 1120, 56, 2], bar: [64, 1856, 990],
        cardList: false, cardTopic: false, end: rect(64, 146, 1120, 830) };
    }
    if (mode === 'camera') {
      const card = rect(1272, 146, 584, 796);
      return { ...head, cam: rect(64, 146, 1180, 796), card, cardList: true, cardTopic: false, line: [64, 1040, 1500, 52], bar: [64, 1856, 978], end: card };
    }
    return { ...head, scr: rect(64, 146, 1360, 765), card: rect(1456, 146, 400, 765), cardList: false, cardTopic: true, bar: [64, 1856, 978],
      end: rect(64, 146, 1792, 765) };
  }
  const head = { logo: [120, 178, 36], label: [120, 226, 36], code: [960, 178, 38], bar: [120, 960, 256], line: [120, 330, 840, 48] } as const;
  if (mode === 'both') {
    const scr = rect(120, 368, 840, 472);
    return { ...head, scr, cam: rect(120, 868, 840, 780), cardList: false, cardTopic: false, end: scr };
  }
  if (mode === 'camera') {
    const card = rect(120, 368, 840, 412);
    return { ...head, card, cam: rect(120, 808, 840, 840), cardList: false, cardTopic: false, end: card };
  }
  return { ...head, scr: rect(120, 368, 840, 472), card: rect(120, 872, 840, 560), cardList: true, cardTopic: false, end: rect(120, 368, 840, 1064) };
}

const layouts = new Map<string, GL>();
function L(mode: CompositeMode, aspect: RecordAspect): GL {
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

function plate(ctx: Ctx, r: Rect, tone = CARD): void {
  fill(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, EDGE);
  fillR(ctx, r, tone);
}

function drawBackground(ctx: Ctx, f: Frame): void {
  const sc = sceneFor(ctx, f);
  fill(ctx, 0, 0, sc.W, sc.H, BG);
  const l = L(f.mode, f.aspect);
  if (l.scr) plate(ctx, l.scr);
  if (l.cam) plate(ctx, l.cam, CAM_TONE);
}

// ---------------------------------------------------------------------------------------------

function drawLabel(ctx: Ctx, sc: Scene, key: LabelKey, x: number, y: number, size: number): void {
  const mono = minText(sc);
  if (key === 'mode') {
    setFont(ctx, F_MONO, mono);
    text(ctx, sc.modeName, x, y, AMBER);
    let xx = x + measure(ctx, sc.modeName);
    text(ctx, SLASH, xx, y, DIM);
    xx += measure(ctx, SLASH);
    text(ctx, sc.durationText, xx, y, AMBER);
    return;
  }
  if (key === 'done') {
    setFont(ctx, F_DONE, size + 2);
    text(ctx, sc.str.timeUp, x, y, AMBER);
    text(ctx, '.', x + measure(ctx, sc.str.timeUp), y, TEXT);
    return;
  }
  const nn = key === 'research' ? '00' : NUMS[key === 's0' ? 0 : key === 's1' ? 1 : 2];
  setFont(ctx, F_MONO_B, mono);
  text(ctx, nn, x, y, AMBER);
  const nw = measure(ctx, nn);
  setFont(ctx, F_NAME, size);
  text(ctx, key === 'research' ? sc.str.research : sc.str.steps[key === 's0' ? 0 : key === 's1' ? 1 : 2], x + nw + 14, y, TEXT);
}

function labelSlot(ctx: Ctx, sc: Scene, l: GL): void {
  const [x, y, size] = l.label;
  if (sc.labelPrev) {
    ctx.globalAlpha = 1 - sc.labelK;
    drawLabel(ctx, sc, sc.labelPrev, x, y - 14 * sc.labelK, size);
  }
  ctx.globalAlpha = sc.labelK;
  drawLabel(ctx, sc, sc.label, x, y + 14 * (1 - sc.labelK), size);
  ctx.globalAlpha = 1;
}

function timecode(ctx: Ctx, sc: Scene, l: GL): void {
  const [x, y, size] = l.code;
  setFont(ctx, F_CODE, size);
  const total = sc.totalClock;
  text(ctx, total, x, y, DIM, 'right');
  let right = x - measure(ctx, total);
  text(ctx, SLASH, right, y, DIM, 'right');
  right -= measure(ctx, SLASH);
  text(ctx, sc.clockText, right, y, sc.timeUp ? AMBER : sc.running ? TEXT : DIM, 'right');
}

function drawTopic(ctx: Ctx, sc: Scene, kind: TopicKind, topic: string | null, x0: number, y: number, w0: number, size: number, lines: number, prefix: boolean): void {
  let x = x0;
  let w = w0;
  if (kind === 'topic' && topic) {
    const f = fit(ctx, topic, F_TOPIC, w - 12, lines, size, sc.wide ? 34 : 36);
    let yy = y;
    for (const line of f.lines) {
      text(ctx, line, x, yy, TEXT);
      yy += f.size * 1.08;
    }
    return;
  }
  // A dim cursor bar where the topic will be typed; while the wheel spins an amber block scans it.
  // Without a "konu" label above (single-line slots), the bar is prefixed with it.
  if (prefix) {
    setFont(ctx, F_MONO, minText(sc));
    text(ctx, sc.str.topic, x, y - size * 0.34 + minText(sc) * 0.36, AMBER);
    const pw = measure(ctx, sc.str.topic) + 24;
    x += pw;
    w -= pw;
  }
  const barW = Math.min(w, 460);
  const barY = y - size * 0.34;
  fill(ctx, x, barY, barW, 4, FAINT);
  if (kind === 'spin') {
    const seg = 90;
    const p = 0.5 + 0.5 * Math.sin(sc.tSec * 3.4);
    fill(ctx, x + (barW - seg) * p, barY - 3, seg, 10, AMBER);
    setFont(ctx, F_MONO, minText(sc));
    text(ctx, sc.str.drawing, x + barW + 24, y - size * 0.34 + minText(sc) * 0.36, DIM);
  } else {
    // blinking caret
    if (Math.floor(sc.tSec * 1.6) % 2 === 0) fill(ctx, x, barY - size * 0.5, 6, size * 0.62, AMBER);
  }
}

function topicAt(ctx: Ctx, sc: Scene, x: number, y: number, w: number, size: number, lines: number, alpha = 1, prefix = false): void {
  if (sc.topicPrevKind) {
    const a = (1 - clamp(sc.topicK * 2)) * alpha;
    if (a > 0) {
      ctx.globalAlpha = a;
      drawTopic(ctx, sc, sc.topicPrevKind, sc.topicPrevText, x, y, w, size, lines, prefix);
    }
  }
  ctx.globalAlpha = sc.topicK * alpha;
  drawTopic(ctx, sc, sc.topicKind, sc.topicText, x, y + 10 * (1 - sc.topicK), w, size, lines, prefix);
  ctx.globalAlpha = 1;
}

/** "konu" in mono amber over a topic block. */
function topicBlock(ctx: Ctx, sc: Scene, x: number, y: number, w: number, size: number, lines: number, alpha = 1): void {
  ctx.globalAlpha = alpha;
  setFont(ctx, F_MONO, minText(sc));
  text(ctx, sc.str.topic, x, y, AMBER);
  topicAt(ctx, sc, x, y + size * 1.25, w, size, lines, alpha);
}

/** The studio-monitor timer card. */
function card(ctx: Ctx, sc: Scene, l: GL, r: Rect, alpha: number): void {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  plate(ctx, r);
  const pad = sc.wide ? 44 : 44;
  const { x, y, w, h } = r;
  const mono = minText(sc);
  const digitColor = sc.timeUp ? AMBER : sc.running ? TEXT : DIM;
  if (l.cardTopic) {
    // screen-only landscape: topic on top, time at the bottom
    topicBlock(ctx, sc, x + pad, y + pad + mono * 0.8, w - pad * 2, 48, 4, alpha);
    ctx.globalAlpha = alpha;
    const ds = fitSize(ctx, '00:00', F_DIGITS, w - pad * 2 + 8, 150);
    setFont(ctx, F_MONO, mono);
    text(ctx, sc.str.remaining, x + pad, y + h - pad - ds * 0.8, AMBER);
    setFont(ctx, F_DIGITS, ds);
    text(ctx, sc.clockText, x + pad - 6, y + h - pad, digitColor);
    ctx.globalAlpha = 1;
    return;
  }
  setFont(ctx, F_MONO, mono);
  text(ctx, sc.str.remaining, x + pad, y + pad + mono * 0.8, AMBER);
  const ds = fitSize(ctx, '00:00', F_DIGITS, w - pad * 2 + 8, sc.wide ? 210 : 250);
  const base = l.cardList || sc.wide ? y + pad + mono * 0.8 + ds * 0.9 : y + h - pad - 6;
  setFont(ctx, F_DIGITS, ds);
  text(ctx, sc.clockText, x + pad - 8, base, digitColor);
  if (l.cardList) {
    const gap = sc.wide ? 58 : 62;
    const y0 = y + h - pad - 2 * gap;
    for (let i = 0; i < 3; i += 1) {
      const cur = sc.running && i === sc.arc;
      const hit = (sc.running || sc.timeUp) && i <= sc.arc;
      setFont(ctx, F_MONO_B, mono);
      text(ctx, NUMS[i], x + pad, y0 + i * gap, cur ? AMBER : DIM);
      setFont(ctx, F_NAME, sc.wide ? 34 : 38);
      text(ctx, sc.str.steps[i], x + pad + mono * 1.9, y0 + i * gap, hit ? TEXT : DIM);
    }
  }
  ctx.globalAlpha = 1;
}

function endCard(ctx: Ctx, sc: Scene, r: Rect): void {
  const e = sc.end;
  const inA = eOut(e / 0.45);
  // Whatever was there dims away, then the plate lights up.
  ctx.globalAlpha = inA;
  fill(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, BG);
  const up = (1 - eOut(e)) * 30;
  const rr = rect(r.x, r.y + up, r.w, r.h);
  plate(ctx, rr);
  fill(ctx, rr.x, rr.y, rr.w * eOut(e), 5, AMBER);
  const a = eOut((e - 0.35) / 0.65) * inA;
  if (a > 0) {
    ctx.globalAlpha = a;
    const pad = rr.w * 0.08;
    const w = rr.w - pad * 2;
    const big = Math.min(rr.w > 1200 ? 140 : sc.wide ? 96 : 110, w / 6.4);
    const cy = rr.y + rr.h / 2;
    const x = rr.x + pad;
    drawLogo(ctx, x, cy - big * 0.3, big, LOGO, 'ready', sc.levels, sc.tSec, sc.str.wordmark);
    const tag = Math.max(minText(sc), Math.min(big * 0.42, fitSize(ctx, `${sc.str.tagline}.`, F_TAG, w, big * 0.42)));
    setFont(ctx, F_TAG, tag);
    const ty = cy + big * 0.56;
    text(ctx, sc.str.tagline, x, ty, TEXT);
    text(ctx, '.', x + measure(ctx, sc.str.tagline), ty, AMBER);
    setFont(ctx, F_CODE, Math.max(minText(sc), Math.min(big * 0.3, fitSize(ctx, sc.str.address, F_CODE, w, big * 0.3))));
    text(ctx, sc.str.address, x, ty + Math.max(tag * 1.3, big * 0.5), AMBER);
  }
  ctx.globalAlpha = 1;
}

function drawOverlays(ctx: Ctx, f: Frame): void {
  const sc = sceneFor(ctx, f);
  const l = L(f.mode, f.aspect);
  const fade = 1 - eOut(sc.end / 0.45);

  if (l.card) card(ctx, sc, l, l.card, fade);
  if (l.block) {
    const [x, y, w, size, lines] = l.block;
    topicBlock(ctx, sc, x, y, w, size, lines);
  }
  if (l.line) {
    const [x, y, w, size] = l.line;
    topicAt(ctx, sc, x, y, w, size, 1, 1, true);
  }

  const [lx, ly, ls] = l.logo;
  drawLogo(ctx, lx, ly, ls, LOGO, sc.logo, sc.levels, sc.tSec, sc.str.wordmark);
  labelSlot(ctx, sc, l);
  timecode(ctx, sc, l);
  const [b0, b1, by] = l.bar;
  fill(ctx, b0, by - 1, b1 - b0, 2, FAINT);
  fill(ctx, b0, by - 2, (b1 - b0) * sc.progress, 4, AMBER);

  if (sc.end > 0) endCard(ctx, sc, l.end);
}

export const gece: StyleDefinition = {
  id: 'gece',
  labelKey: 'gece',
  aspects: ['wide', 'tall'],
  fonts: ['Space Grotesk:500,600,700', 'IBM Plex Mono:500,600'],
  layout,
  drawBackground,
  drawOverlays,
};
