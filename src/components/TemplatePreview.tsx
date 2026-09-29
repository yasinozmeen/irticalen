import { useEffect, useRef } from 'preact/hooks';
import type { CompositeMode, Frame, FramePhase, FrameStage, RecordAspect, StyleDefinition } from '../lib/compositor';
import { ensureStyleFonts } from '../lib/compositor/fonts';
import { resetScene } from '../lib/compositor/styles/kit';
import { drawAvatar, drawScreenPlaceholder } from '../lib/compositor/styles/placeholders';
import { speechArcStep } from '../lib/timer';
import type { Dictionary, Locale } from '../i18n';

interface Props {
  style: StyleDefinition;
  aspect: RecordAspect;
  mode: CompositeMode;
  dict: Dictionary;
  locale: Locale;
}

/** CSS width of the tile — fits the settings dialog's narrow column. */
const WIDE_WIDTH = 260;
const TALL_WIDTH = 110;
const LOOP_MS = 4000;
const TOTAL_SEC = 180;
const FRAME_MS = 1000 / 30;
/** The mid-speech moment shown when motion is reduced. */
const STILL_AT_MS = 1500;
/** An example topic — the preview only needs something plausible to set in type. */
const SAMPLE_TOPIC: Record<Locale, string> = { tr: 'batık maliyet yanılgısı', en: 'the sunk cost fallacy' };

/**
 * One moment of the 4-second story the preview loops through, compressed from a real recording:
 * 0–0.6 s opening · 0.6–2.4 s speech (the timer runs through all three outline steps) ·
 * 2.4–3.0 s "süre." · 3.0–4.0 s the closing card. (A real recording shows the closing card 3 s after
 * time is up; here it comes in as if the speaker had pressed stop, the only way to fit it in.)
 */
function frameAt(u: number, style: { mode: CompositeMode; aspect: RecordAspect; locale: Locale }): Frame {
  let phase: FramePhase;
  let stage: FrameStage;
  let elapsed = 0;
  if (u < 600) {
    phase = 'intro';
    stage = 'landed';
  } else if (u < 2400) {
    phase = 'speech';
    stage = 'speech';
    elapsed = ((u - 600) / 1800) * TOTAL_SEC;
  } else if (u < 3000) {
    phase = 'overtime';
    stage = 'done';
    elapsed = TOTAL_SEC;
  } else {
    phase = 'outro';
    stage = 'done';
    elapsed = TOTAL_SEC;
  }
  return {
    t: u,
    topic: SAMPLE_TOPIC[style.locale],
    locale: style.locale,
    phase,
    stage,
    sessionMode: 'off-the-cuff',
    elapsedSec: elapsed,
    totalSec: TOTAL_SEC,
    arcStep: speechArcStep(elapsed, TOTAL_SEC),
    micLevel: phase === 'speech' ? 0.55 + 0.35 * Math.sin(u / 90) : 0,
    mode: style.mode,
    aspect: style.aspect,
  };
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * A small live preview of the selected style + aspect + recording mode, drawn with the style's own
 * `layout`/`drawBackground`/`drawOverlays` — the very code the recording uses — so it can never drift
 * from the real output. There is no camera here (asking for permission just to preview would be too
 * early): a plain profile-avatar stands in for the camera and a plain window for the screen. The
 * loop only runs while the tile is on screen and the tab is visible; with reduced motion it is a
 * single still frame.
 */
export function TemplatePreview({ style, aspect, mode, dict, locale }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cssWidth = aspect === 'wide' ? WIDE_WIDTH : TALL_WIDTH;
  const cssHeight = aspect === 'wide' ? Math.round((cssWidth * 9) / 16) : Math.round((cssWidth * 16) / 9);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    resetScene(ctx);
    const logicalW = aspect === 'wide' ? 1920 : 1080;
    const scale = canvas.width / logicalW;
    const reduced = prefersReducedMotion();
    const opts = { mode, aspect, locale };

    const draw = (u: number): void => {
      const frame = frameAt(u, opts);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      style.drawBackground(ctx, frame);
      const rects = style.layout(mode, aspect, aspect === 'wide' ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 }, {});
      if (rects.screenRect) drawScreenPlaceholder(ctx, rects.screenRect);
      if (rects.cameraRect) drawAvatar(ctx, rects.cameraRect);
      style.drawOverlays(ctx, frame);
    };

    let raf = 0;
    let running = false;
    let onScreen = true;
    let start = 0;
    let last = -Infinity;
    let disposed = false;

    const tick = (now: number): void => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS - 1) return;
      last = now;
      draw((now - start) % LOOP_MS);
    };
    const update = (): void => {
      const shouldRun = !reduced && onScreen && document.visibilityState === 'visible';
      if (shouldRun && !running) {
        running = true;
        start = performance.now();
        last = -Infinity;
        resetScene(ctx);
        raf = requestAnimationFrame(tick);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    // First paint at once (a settled mid-speech frame), again once the style's fonts are in.
    draw(STILL_AT_MS);
    void ensureStyleFonts(style).then(() => {
      if (disposed) return;
      if (!running) {
        resetScene(ctx);
        draw(STILL_AT_MS);
      }
    });

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        update();
      });
      observer.observe(canvas);
    }
    document.addEventListener('visibilitychange', update);
    update();

    // A soft cross-fade into the new style/aspect instead of a jump.
    if (!reduced && typeof canvas.animate === 'function') {
      canvas.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    }

    return () => {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [style, aspect, mode, locale, cssWidth, cssHeight]);

  return (
    <canvas
      ref={canvasRef}
      class="template-preview"
      style={{ width: `${cssWidth}px`, maxWidth: '100%', height: 'auto', aspectRatio: `${cssWidth} / ${cssHeight}` }}
      role="img"
      aria-label={`${dict.settings.previewLabel}: ${(dict.record.styles as Record<string, string>)[style.labelKey] ?? style.labelKey}`}
    />
  );
}
