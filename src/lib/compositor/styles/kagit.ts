import type {
  CompositeLayout,
  CompositeMode,
  CompositeSources,
  Frame,
  RecordAspect,
  Size,
  StyleDefinition,
} from '../types';
import { cornerPip, fullBleed, stackedBands } from '../layout';

/**
 * Temporary placeholder style — the site's own "F — Kâğıt" palette (paper background, ink text, no
 * boxes/shadows/rounded corners) drawn straight onto the canvas so the composited recording doesn't
 * look bare while a designer works on the real styles. A future style file drops in next to this one
 * and is added to `./index`'s registry — nothing else about the engine changes.
 *
 * Layout: 'camera'/'screen' modes are a single full-bleed rect at any aspect; 'both' mode insets the
 * second feed as a small corner picture-in-picture at 16:9 ('wide'), or stacks the two feeds
 * top/bottom at 9:16 ('tall') — a corner pip would be illegibly small on a portrait canvas.
 */

const PAPER = '#f3eee2';
const INK = '#1d1a16';
const PENCIL = '#6f695c';
const RULE = '#d6cfbf';
const RED = '#b8281c';

function layout(mode: CompositeMode, aspect: RecordAspect, output: Size, _sources: CompositeSources): CompositeLayout {
  if (mode === 'camera') return { cameraRect: fullBleed(output) };
  if (mode === 'screen') return { screenRect: fullBleed(output) };
  if (aspect === 'wide') return { screenRect: fullBleed(output), cameraRect: cornerPip(output) };
  const { top, bottom } = stackedBands(output);
  return { screenRect: top, cameraRect: bottom };
}

function drawBackground(ctx: CanvasRenderingContext2D, _frame: Frame): void {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
}

/** Both output resolutions share the same 1080 minimum edge (1920×1080 / 1080×1920) — sizing
 * everything off it keeps text/line weight identical between 'wide' and 'tall'. */
function unitOf(ctx: CanvasRenderingContext2D): number {
  const { width, height } = ctx.canvas;
  return Math.min(width, height) / 20;
}

function drawOverlays(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const { width, height } = ctx.canvas;
  const unit = unitOf(ctx);
  const margin = unit * 0.8;

  // A thin ink frame around the smaller inset feed in 'both'/'wide' — the pip has no video-level
  // border of its own, so without this it would blend edge-to-edge into the main feed.
  if (frame.mode === 'both') {
    const { cameraRect } = layout(frame.mode, frame.aspect, { w: width, h: height }, {});
    if (cameraRect && frame.aspect === 'wide') {
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, unit * 0.05);
      ctx.strokeRect(cameraRect.x, cameraRect.y, cameraRect.w, cameraRect.h);
    }
  }

  // Wordmark, top-left — small, lowercase, always present as a quiet signature.
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = PENCIL;
  ctx.font = `italic ${Math.round(unit * 0.55)}px Newsreader, Georgia, serif`;
  ctx.fillText('irticalen.', margin, margin + unit * 0.4);

  // A small red dot next to the wordmark during 'outro' — the same "kayıt" cue the on-screen UI uses.
  if (frame.phase === 'outro') {
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(margin + unit * 5.4, margin + unit * 0.22, unit * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bottom bar: an ink progress line (the site's "mürekkep cetvel" motif, not a ring) then the topic.
  const lineY = height - margin - unit * 1.5;
  const lineW = width - margin * 2;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = Math.max(1, unit * 0.05);
  ctx.beginPath();
  ctx.moveTo(margin, lineY);
  ctx.lineTo(margin + lineW, lineY);
  ctx.stroke();

  const ratio =
    frame.phase === 'intro'
      ? 0
      : frame.phase === 'speech'
        ? frame.totalSec > 0
          ? Math.min(1, Math.max(0, frame.elapsedSec / frame.totalSec))
          : 0
        : 1; // overtime/outro: run its course
  if (ratio > 0) {
    ctx.strokeStyle = frame.phase === 'outro' ? RED : INK;
    ctx.beginPath();
    ctx.moveTo(margin, lineY);
    ctx.lineTo(margin + lineW * ratio, lineY);
    ctx.stroke();
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `600 ${Math.round(unit * 1.05)}px Newsreader, Georgia, serif`;
  const topic = frame.topic.toLowerCase();
  ctx.fillText(topic, margin, height - margin);

  // The opening card: the topic word again, large and centered, for the recording's first ~3s —
  // gives the file a clean "cold open" instead of starting mid-scene.
  if (frame.phase === 'intro') {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = `600 ${Math.round(unit * 1.8)}px Newsreader, Georgia, serif`;
    ctx.fillText(topic, width / 2, height / 2);
    ctx.fillStyle = PENCIL;
    ctx.font = `italic ${Math.round(unit * 0.6)}px Newsreader, Georgia, serif`;
    ctx.fillText('irticalen', width / 2, height / 2 + unit * 1.2);
  }
}

export const kagit: StyleDefinition = {
  id: 'kagit',
  labelKey: 'kagit',
  aspects: ['wide', 'tall'],
  layout,
  drawBackground,
  drawOverlays,
};
