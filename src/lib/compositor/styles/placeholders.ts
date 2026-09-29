import type { Rect } from '../types';

/**
 * Stand-ins for the camera and the shared screen where there is no real stream — the settings
 * preview and the design boards. Drawn straight into the rect (not cover-cropped from a fixed
 * source) so the figure is well framed in every layout, portrait or landscape.
 */

const AVATAR_GROUND = '#e4e4e2';
const AVATAR_FIGURE = '#a3a3a0';

/**
 * The classic profile avatar: light grey ground, a darker grey full-circle head and a wide half-dome
 * for the shoulders, no neck, flat and plain.
 */
export function drawAvatar(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.fillStyle = AVATAR_GROUND;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // Frame the figure on the shorter side (a little looser on tall portrait rects, as a real camera
  // crop would be), sitting on the bottom edge like a head-and-shoulders shot.
  const s = Math.min(r.w, r.h * 0.9);
  const cx = r.x + r.w / 2;
  const bottom = r.y + r.h;
  const bodyRx = s * 0.4;
  const bodyRy = s * 0.34;
  const headR = s * 0.175;
  const gap = s * 0.045;
  const headCy = bottom - bodyRy - gap - headR;

  ctx.fillStyle = AVATAR_FIGURE;
  ctx.beginPath();
  ctx.ellipse(cx, bottom, bodyRx, bodyRy, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A plain window: pale page, a title bar with three dots, a heading bar and a few text lines. */
export function drawScreenPlaceholder(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.fillStyle = '#f7f7f5';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const u = r.w / 100;
  const barH = Math.max(4, u * 3.4);
  ctx.fillStyle = '#e2e2df';
  ctx.fillRect(r.x, r.y, r.w, barH);
  ctx.fillStyle = '#c4c4c0';
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(r.x + u * (2.4 + i * 2.2), r.y + barH / 2, u * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }
  const left = r.x + u * 8;
  let y = r.y + barH + u * 6;
  ctx.fillStyle = '#9b9b97';
  ctx.fillRect(left, y, u * 34, u * 2.6);
  y += u * 7;
  ctx.fillStyle = '#d3d3cf';
  const widths = [78, 70, 82, 44, 0, 74, 80, 58];
  for (const w of widths) {
    if (w > 0 && y + u * 1.4 < r.y + r.h - u * 4) ctx.fillRect(left, y, u * w, u * 1.4);
    y += u * 4.2;
  }
  ctx.restore();
}
