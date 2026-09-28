import { useEffect, useRef } from 'preact/hooks';
import type { CompositeMode, Frame, RecordAspect, StyleDefinition } from '../lib/compositor';
import { outputSizeForAspect } from '../lib/compositor';
import type { Dictionary, Locale } from '../i18n';

interface Props {
  style: StyleDefinition;
  aspect: RecordAspect;
  mode: CompositeMode;
  dict: Dictionary;
  locale: Locale;
}

const PREVIEW_WIDTH = 220;
/** Placeholder tones standing in for a real camera/screen video frame — distinct enough from the
 * paper background (`#f3eee2`) to read as "a video would be here", without pretending to be footage. */
const CAMERA_TONE = '#c9c2b2';
const SCREEN_TONE = '#ddd7c9';

/**
 * A small static preview of the selected style + aspect, drawn with the engine's own
 * `layout`/`drawBackground`/`drawOverlays` functions — so once a designer's real styles replace the
 * temporary `kagit` one, this preview is correct automatically, with no changes here. It stands in
 * for camera/screen video with flat placeholder tones (there is no live stream to show in Settings);
 * an animated live preview is a later improvement (see CLAUDE.md's task notes) — this is deliberately
 * just a frozen frame.
 */
export function TemplatePreview({ style, aspect, mode, dict, locale }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const output = outputSizeForAspect(aspect);
    canvas.width = output.w;
    canvas.height = output.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // A representative mid-speech moment — not the real topic/elapsed time (Settings has neither).
    const frame: Frame = {
      t: 0,
      topic: dict.reel.landed,
      locale,
      phase: 'speech',
      elapsedSec: 24,
      totalSec: 60,
      arcStep: 1,
      mode,
      aspect,
    };

    style.drawBackground(ctx, frame);
    const layout = style.layout(mode, aspect, output, {});
    if (layout.screenRect) {
      ctx.fillStyle = SCREEN_TONE;
      ctx.fillRect(layout.screenRect.x, layout.screenRect.y, layout.screenRect.w, layout.screenRect.h);
    }
    if (layout.cameraRect) {
      ctx.fillStyle = CAMERA_TONE;
      ctx.fillRect(layout.cameraRect.x, layout.cameraRect.y, layout.cameraRect.w, layout.cameraRect.h);
    }
    style.drawOverlays(ctx, frame);
  }, [style, aspect, mode, dict, locale]);

  const previewHeight = aspect === 'wide' ? Math.round((PREVIEW_WIDTH * 9) / 16) : Math.round((PREVIEW_WIDTH * 16) / 9);

  return (
    <canvas
      ref={canvasRef}
      class="template-preview"
      style={{ width: `${PREVIEW_WIDTH}px`, height: `${previewHeight}px` }}
      role="img"
      aria-label={dict.settings.previewLabel}
    />
  );
}
