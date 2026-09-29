/**
 * A recording stand-in for `CanvasRenderingContext2D` (jsdom has no canvas). Every method is a no-op
 * except `measureText` (width ≈ 0.5 em per character, from the px size in `font`) and `fillText`,
 * which is logged with its box so tests can check where text lands.
 */
export interface TextCall {
  readonly text: string;
  readonly left: number;
  readonly right: number;
  /** Baseline and an approximate top (cap height ≈ 0.75 em). */
  readonly y: number;
  readonly top: number;
  readonly alpha: number;
  readonly clipped: boolean;
  /** Font size in px. */
  readonly size: number;
}

export interface FakeCtx {
  readonly ctx: CanvasRenderingContext2D;
  readonly texts: TextCall[];
  reset(): void;
}

export function fakeContext(width: number, height: number): FakeCtx {
  const texts: TextCall[] = [];
  let clipDepth = 0;
  const saveStack: { clip: number; alpha: number; font: string; align: CanvasTextAlign }[] = [];
  const state = {
    font: '10px sans-serif',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    fillStyle: '#000' as string | CanvasGradient | CanvasPattern,
    strokeStyle: '#000' as string | CanvasGradient | CanvasPattern,
    globalAlpha: 1,
    lineWidth: 1,
    lineJoin: 'miter' as CanvasLineJoin,
    letterSpacing: '0px',
  };
  const sizeOf = (): number => {
    const m = /(\d+(?:\.\d+)?)px/.exec(state.font);
    return m ? Number(m[1]) : 10;
  };
  const noop = (): void => undefined;
  const ctx = {
    canvas: { width, height },
    get font() {
      return state.font;
    },
    set font(v: string) {
      state.font = v;
    },
    get textAlign() {
      return state.textAlign;
    },
    set textAlign(v: CanvasTextAlign) {
      state.textAlign = v;
    },
    get textBaseline() {
      return state.textBaseline;
    },
    set textBaseline(v: CanvasTextBaseline) {
      state.textBaseline = v;
    },
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(v) {
      state.fillStyle = v;
    },
    get strokeStyle() {
      return state.strokeStyle;
    },
    set strokeStyle(v) {
      state.strokeStyle = v;
    },
    get globalAlpha() {
      return state.globalAlpha;
    },
    set globalAlpha(v: number) {
      if (!Number.isFinite(v)) throw new Error(`globalAlpha set to ${v}`);
      state.globalAlpha = v;
    },
    get lineWidth() {
      return state.lineWidth;
    },
    set lineWidth(v: number) {
      state.lineWidth = v;
    },
    get lineJoin() {
      return state.lineJoin;
    },
    set lineJoin(v: CanvasLineJoin) {
      state.lineJoin = v;
    },
    get letterSpacing() {
      return state.letterSpacing;
    },
    set letterSpacing(v: string) {
      state.letterSpacing = v;
    },
    measureText(text: string) {
      return { width: text.length * sizeOf() * 0.5 } as TextMetrics;
    },
    fillText(text: string, x: number, y: number) {
      for (const n of [x, y]) if (!Number.isFinite(n)) throw new Error(`fillText(${text}) at non-finite ${x},${y}`);
      const w = text.length * sizeOf() * 0.5;
      const align = state.textAlign;
      const left = align === 'right' || align === 'end' ? x - w : align === 'center' ? x - w / 2 : x;
      texts.push({ text, left, right: left + w, y, top: y - sizeOf() * 0.75, alpha: state.globalAlpha, clipped: clipDepth > 0, size: sizeOf() });
    },
    fillRect(...args: number[]) {
      for (const n of args) if (!Number.isFinite(n)) throw new Error(`fillRect non-finite ${args.join(',')}`);
    },
    save() {
      saveStack.push({ clip: clipDepth, alpha: state.globalAlpha, font: state.font, align: state.textAlign });
    },
    restore() {
      const s = saveStack.pop();
      if (s) {
        clipDepth = s.clip;
        state.globalAlpha = s.alpha;
        state.font = s.font;
        state.textAlign = s.align;
      }
    },
    clip() {
      clipDepth += 1;
    },
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    rect: noop,
    arc: noop,
    ellipse: noop,
    fill: noop,
    stroke: noop,
    strokeRect: noop,
    drawImage: noop,
    setTransform: noop,
    setLineDash: noop,
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    texts,
    reset() {
      texts.length = 0;
    },
  };
}
