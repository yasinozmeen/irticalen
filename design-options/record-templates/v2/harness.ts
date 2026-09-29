/* Board harness for the v2 frames: renders real style code (src/lib/compositor/styles) into PNGs.
   Build: npx esbuild design-options/record-templates/v2/harness.ts --bundle --format=iife --outfile=design-options/record-templates/v2/harness.js
   Frames are simulated as a real recording would feed them (a few seconds of history per shot), so
   transitions have settled exactly as they would have. */
import { COMPOSITE_STYLES } from '../../../src/lib/compositor/styles';
import { ensureStyleFonts } from '../../../src/lib/compositor/fonts';
import { drawAvatar, drawScreenPlaceholder } from '../../../src/lib/compositor/styles/placeholders';
import { speechArcStep } from '../../../src/lib/timer';
import type { CompositeMode, Frame, FramePhase, FrameStage, RecordAspect } from '../../../src/lib/compositor/types';

const TOTAL = 180;
const SPEECH_AT = 14000;
const DONE_AT = SPEECH_AT + TOTAL * 1000;

interface Script { topicAt: number; spinAt: number; research: boolean; locale: 'tr' | 'en'; stopAt: number | null }

function frameAt(t: number, mode: CompositeMode, aspect: RecordAspect, s: Script): Frame {
  let stage: FrameStage = 'idle';
  let topic: string | null = null;
  if (t >= s.spinAt) stage = 'spinning';
  if (t >= s.topicAt) { stage = s.research ? 'research' : 'landed'; topic = s.locale === 'en' ? 'the sunk cost fallacy' : 'batık maliyet yanılgısı'; }
  let elapsed = 0;
  if (t >= SPEECH_AT) { stage = 'speech'; elapsed = Math.min(TOTAL, Math.floor((t - SPEECH_AT) / 1000)); }
  if (t >= DONE_AT) { stage = 'done'; elapsed = TOTAL; }
  let phase: FramePhase = t < 3000 ? 'intro' : stage === 'speech' ? 'speech' : stage === 'done' ? 'overtime' : 'pre';
  if (s.stopAt !== null && t >= s.stopAt) phase = 'outro';
  return {
    t, topic, locale: s.locale, phase, stage, sessionMode: s.research ? 'deep-research' : 'off-the-cuff',
    elapsedSec: elapsed, totalSec: TOTAL, arcStep: speechArcStep(elapsed, TOTAL),
    micLevel: stage === 'speech' ? 0.5 + 0.4 * Math.sin(t / 97) * Math.cos(t / 331) : 0, mode, aspect,
  };
}

function render(styleId: string, mode: CompositeMode, aspect: RecordAspect, at: number, s: Script, outW: number, safe = false): string {
  const style = COMPOSITE_STYLES.find((x) => x.id === styleId)!;
  const W = aspect === 'wide' ? 1920 : 1080, H = aspect === 'wide' ? 1080 : 1920;
  const c = document.createElement('canvas'); c.width = outW; c.height = Math.round(outW * H / W);
  const ctx = c.getContext('2d')!; const k = outW / W;
  const out = { w: W, h: H };
  for (let t = Math.max(0, at - 5000); t <= at; t += 33) {
    const f = frameAt(t, mode, aspect, s);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    style.drawBackground(ctx, f);
    const r = style.layout(mode, aspect, out, {});
    if (r.screenRect) drawScreenPlaceholder(ctx, r.screenRect);
    if (r.cameraRect) drawAvatar(ctx, r.cameraRect);
    style.drawOverlays(ctx, f);
  }
  if (safe && aspect === 'tall') {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.strokeStyle = 'rgba(0,160,255,0.9)'; ctx.lineWidth = 4; ctx.setLineDash([18, 12]);
    ctx.strokeRect(120, 120, 840, 1540);
  }
  return c.toDataURL('image/png');
}

function previewFrame(u: number, mode: CompositeMode, aspect: RecordAspect): Frame {
  let phase: FramePhase = 'intro', stage: FrameStage = 'landed', elapsed = 0;
  if (u >= 600 && u < 2400) { phase = 'speech'; stage = 'speech'; elapsed = ((u - 600) / 1800) * TOTAL; }
  else if (u >= 2400 && u < 3000) { phase = 'overtime'; stage = 'done'; elapsed = TOTAL; }
  else if (u >= 3000) { phase = 'outro'; stage = 'done'; elapsed = TOTAL; }
  return { t: u, topic: 'batık maliyet yanılgısı', locale: 'tr', phase, stage, sessionMode: 'off-the-cuff', elapsedSec: elapsed, totalSec: TOTAL,
    arcStep: speechArcStep(elapsed, TOTAL), micLevel: phase === 'speech' ? 0.55 + 0.35 * Math.sin(u / 90) : 0, mode, aspect };
}
function preview(styleId: string, aspect: RecordAspect, at: number, outW: number): string {
  const style = COMPOSITE_STYLES.find((x) => x.id === styleId)!;
  const W = aspect === 'wide' ? 1920 : 1080, H = aspect === 'wide' ? 1080 : 1920;
  const c = document.createElement('canvas'); c.width = outW; c.height = Math.round(outW * H / W);
  const ctx = c.getContext('2d')!; const k = outW / W;
  for (let u = 0; u <= at; u += 33) {
    const f = previewFrame(u, 'both', aspect);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    style.drawBackground(ctx, f);
    const r = style.layout('both', aspect, { w: W, h: H }, {});
    if (r.screenRect) drawScreenPlaceholder(ctx, r.screenRect);
    if (r.cameraRect) drawAvatar(ctx, r.cameraRect);
    style.drawOverlays(ctx, f);
  }
  return c.toDataURL('image/png');
}

const BASE: Script = { spinAt: 8000, topicAt: 10000, research: false, locale: 'tr', stopAt: null };
export const SHOTS: [string, number, Partial<Script>][] = [
  ['1-bos', 6000, {}],
  ['2-cekiliyor', 9000, {}],
  ['3-konu', 12500, {}],
  ['4-arastirma', 12500, { research: true }],
  ['5-konusma', SPEECH_AT + 75000, {}],
  ['6-sure', DONE_AT + 800, {}],
  ['7-kapanis', DONE_AT + 5000, {}],
  ['8-erken-durdur', 7000, { stopAt: 5500 }],
];

function perf(styles: string[], res: Record<string, string>) {
    for (const id of styles) {
      const style = COMPOSITE_STYLES.find((x) => x.id === id)!;
      for (const aspect of ['wide', 'tall'] as const) {
        const W = aspect === 'wide' ? 1920 : 1080, H = aspect === 'wide' ? 1080 : 1920;
        const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d')!;
        const t0 = performance.now(); let n = 0;
        for (let t = SPEECH_AT + 60000; t < SPEECH_AT + 70000; t += 33, n++) {
          const f = frameAt(t, 'both', aspect, BASE);
          style.drawBackground(ctx, f); style.layout('both', aspect, { w: W, h: H }, {}); style.drawOverlays(ctx, f);
        }
        ctx.getImageData(0, 0, 1, 1);
        res[`perf/${id}-${aspect}`] = ((performance.now() - t0) / n).toFixed(2) + ' ms/kare';
      }
    }
  }

async function main() {
  if (new URLSearchParams(location.search).get('perf')) { const res: Record<string, string> = {}; perf(['kagit', 'balon', 'gece', 'izgara'], res); const pre = document.createElement('pre'); pre.id = 'out'; pre.textContent = JSON.stringify(res); document.body.appendChild(pre); return; }
  const q = new URLSearchParams(location.search);
  const styles = (q.get('stil') ?? 'kagit,balon,gece,izgara').split(',');
  const combos: [CompositeMode, RecordAspect][] = [['both', 'wide'], ['both', 'tall'], ['camera', 'wide'], ['camera', 'tall'], ['screen', 'wide'], ['screen', 'tall']];
  const res: Record<string, string> = {};
  for (const id of styles) {
    const ok = await ensureStyleFonts(COMPOSITE_STYLES.find((x) => x.id === id)!);
    res[`${id}/fonts`] = String(ok);
    for (const [mode, aspect] of combos) {
      const shots = q.get('all') ? SHOTS : SHOTS.filter(([n]) => ['1-bos', '5-konusma', '7-kapanis'].includes(n) || mode === 'both');
      for (const [name, at, over] of shots) {
        res[`${id}/${mode}-${aspect}-${name}`] = render(id, mode, aspect, at, { ...BASE, ...over }, aspect === 'wide' ? 960 : 540, aspect === 'tall' && name === '5-konusma');
      }
    }
    if (q.get('en')) res[`${id}/en-both-wide-5-konusma`] = render(id, 'both', 'wide', SPEECH_AT + 75000, { ...BASE, locale: 'en' }, 960);
  }
  // Settings preview tiles: the same 4-second story TemplatePreview loops, at its real size (x2).
  if (q.get('onizleme')) {
    for (const id of styles) {
      for (const [aspect, cssW] of [['wide', 260], ['tall', 110]] as const) {
        for (const u of [300, 1500, 2700, 3900]) res[`onizleme/${id}-${aspect}-${u}`] = preview(id, aspect, u, cssW * 2);
      }
    }
  }
  const pre = document.createElement('pre'); pre.id = 'out'; pre.textContent = JSON.stringify(res); document.body.appendChild(pre);
  document.documentElement.dataset.ready = '1';
}
main();
