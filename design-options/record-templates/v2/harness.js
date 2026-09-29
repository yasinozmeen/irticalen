"use strict";
(() => {
  // ../../../src/lib/compositor/styles/strings.ts
  var ADDRESS = "irticalen.yasinozmeen.me";
  var tr = {
    offTheCuff: "haz\u0131rl\u0131ks\u0131z",
    deepResearch: "ara\u015Ft\u0131rmal\u0131",
    duration(totalSec) {
      if (totalSec >= 60 && totalSec % 60 === 0) return `${totalSec / 60} dakika`;
      return `${Math.max(0, Math.round(totalSec))} saniye`;
    },
    steps: ["nedir?", "bir \xF6rnek", "ne d\xFC\u015F\xFCn\xFCyorum?"],
    timeUp: "s\xFCre",
    research: "ara\u015Ft\u0131rma",
    topic: "konu",
    drawing: "\xE7ekiliyor",
    remaining: "kalan",
    tagline: "konu gelir, s\xF6z sende",
    address: ADDRESS,
    wordmark: "irticalen"
  };
  var en = {
    offTheCuff: "off the cuff",
    deepResearch: "researched",
    duration(totalSec) {
      if (totalSec >= 60 && totalSec % 60 === 0) {
        const minutes = totalSec / 60;
        return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
      }
      return `${Math.max(0, Math.round(totalSec))} seconds`;
    },
    steps: ["what is it?", "an example", "what do I think?"],
    timeUp: "time",
    research: "research",
    topic: "topic",
    drawing: "drawing",
    remaining: "left",
    tagline: "the topic lands, the floor is yours",
    address: ADDRESS,
    wordmark: "irticalen"
  };
  function stringsFor(locale) {
    return locale === "en" ? en : tr;
  }

  // ../../../src/lib/compositor/styles/kit.ts
  var WIDE = { w: 1920, h: 1080 };
  var TALL = { w: 1080, h: 1920 };
  function logicalSize(aspect) {
    return aspect === "wide" ? WIDE : TALL;
  }
  var TALL_SAFE = { x0: 120, x1: 960, y0: 120, y1: 1660 };
  function rect(x, y, w, h) {
    return { x, y, w, h };
  }
  function clamp(x, a = 0, b = 1) {
    return x < a ? a : x > b ? b : x;
  }
  function eOut(x) {
    const c = clamp(x);
    return 1 - (1 - c) * (1 - c) * (1 - c);
  }
  function eInOut(x) {
    const c = clamp(x);
    return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
  }
  function lerp(a, b, k) {
    return a + (b - a) * k;
  }
  function fontSpec(weight, family, style = "normal", trackEm = 0) {
    return { key: `${style}|${weight}|${family}|${trackEm}`, style, weight, family, trackEm };
  }
  var fontStringCache = /* @__PURE__ */ new Map();
  function setFont(ctx, spec, size) {
    const px = Math.round(size);
    const key = `${spec.key}|${px}`;
    let css = fontStringCache.get(key);
    if (css === void 0) {
      css = `${spec.style === "italic" ? "italic " : ""}${spec.weight} ${px}px ${spec.family}`;
      if (fontStringCache.size > 400) fontStringCache.clear();
      fontStringCache.set(key, css);
    }
    ctx.font = css;
    const withSpacing = ctx;
    if ("letterSpacing" in withSpacing) {
      withSpacing.letterSpacing = spec.trackEm === 0 ? "0px" : `${Math.round(spec.trackEm * px * 10) / 10}px`;
    }
  }
  var widthCache = /* @__PURE__ */ new Map();
  var fitCache = /* @__PURE__ */ new Map();
  var fontsListenerAttached = false;
  function invalidateTextCache() {
    widthCache.clear();
    fitCache.clear();
  }
  function attachFontsListener() {
    if (fontsListenerAttached) return;
    fontsListenerAttached = true;
    try {
      const fonts = globalThis.document?.fonts;
      fonts?.addEventListener?.("loadingdone", invalidateTextCache);
    } catch {
    }
  }
  function measure(ctx, text2) {
    attachFontsListener();
    const spacing = ctx.letterSpacing ?? "";
    const key = `${ctx.font}|${spacing}|${text2}`;
    let width = widthCache.get(key);
    if (width === void 0) {
      width = ctx.measureText(text2).width;
      if (widthCache.size > 2e3) widthCache.clear();
      widthCache.set(key, width);
    }
    return width;
  }
  function wrapWords(ctx, text2, maxW) {
    const words = text2.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      if (!word) continue;
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(ctx, candidate) > maxW) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  function fit(ctx, text2, spec, maxW, maxLines, size, minSize) {
    const key = `${spec.key}|${text2}|${Math.round(maxW)}|${maxLines}|${size}|${minSize}`;
    const cached = fitCache.get(key);
    if (cached) {
      setFont(ctx, spec, cached.size);
      return cached;
    }
    let result = null;
    const floor = Math.max(8, Math.floor(minSize * 0.6));
    for (let s = size; s > floor; s -= 2) {
      setFont(ctx, spec, s);
      const lines = wrapWords(ctx, text2, maxW);
      if (lines.length <= maxLines && lines.every((line) => measure(ctx, line) <= maxW)) {
        result = { lines, size: s };
        break;
      }
    }
    if (!result) {
      setFont(ctx, spec, floor);
      result = { lines: wrapWords(ctx, text2, maxW), size: floor };
    }
    setFont(ctx, spec, result.size);
    if (fitCache.size > 300) fitCache.clear();
    fitCache.set(key, result);
    return result;
  }
  function fitSize(ctx, text2, spec, maxW, max) {
    setFont(ctx, spec, 100);
    const w100 = measure(ctx, text2);
    if (w100 <= 0) return max;
    return Math.max(8, Math.min(max, Math.floor(maxW / w100 * 100)));
  }
  function text(ctx, s, x, y, color, align = "left") {
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(s, x, y);
  }
  function fill(ctx, x, y, w, h, color) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function fillR(ctx, r, color) {
    fill(ctx, r.x, r.y, r.w, r.h, color);
  }
  function diamond(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
  }
  function ruler(ctx, x0, x1, yb, p, colors, tickH, barH) {
    const w = x1 - x0;
    fill(ctx, x0, yb - 2, w, 2, colors.base);
    ctx.fillStyle = colors.tick;
    for (let i = 0; i <= 12; i += 1) {
      const x = x0 + w * i / 12 - (i === 12 ? 2 : 0);
      ctx.fillRect(x, yb - tickH, 2, tickH);
    }
    fill(ctx, x0, yb - barH, w * clamp(p), barH, colors.bar);
  }
  var clockCache = [];
  function clock(seconds) {
    const s = Math.max(0, Math.ceil(seconds - 1e-6));
    if (s < 3600) {
      const hit = clockCache[s];
      if (hit) return hit;
    }
    const out = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    if (s < 3600) clockCache[s] = out;
    return out;
  }
  var BUBBLE_PTS = [0, 0, 92, 0, 92, 70, 40, 70, 14, 94, 14, 70, 0, 70];
  var MARK_X = [22, 46, 70];
  function hop(tSec, delay) {
    const p = ((tSec - delay) / 0.48 % 1 + 1) % 1;
    if (p < 0.3) return eOut(p / 0.3);
    if (p < 0.6) return 1 - eOut((p - 0.3) / 0.3);
    return 0;
  }
  function think(tSec, delay) {
    const p = ((tSec - delay) / 1.5 % 1 + 1) % 1;
    return p < 0.4 ? eOut(p / 0.4) : 1 - eOut((p - 0.4) / 0.6);
  }
  function drawLogo(ctx, x, base, size, colors, state, levels, tSec, wordmark = "irticalen") {
    const k = size / 94;
    const top = base - size * 0.8;
    ctx.fillStyle = colors.bubble;
    ctx.beginPath();
    for (let i = 0; i < BUBBLE_PTS.length; i += 2) {
      const px = x + BUBBLE_PTS[i] * k;
      const py = top + BUBBLE_PTS[i + 1] * k;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    if (state === "speech") {
      for (let i = 0; i < 3; i += 1) {
        const h = 40 * clamp(levels[i] ?? 0.5, 0.2, 1);
        const cx = MARK_X[i];
        fill(ctx, x + (cx - 6) * k, top + (35 - h / 2) * k, 12 * k, h * k, i === 1 ? colors.accent : colors.mark);
      }
    } else if (state === "done") {
      fill(ctx, x + 14 * k, top + 28 * k, 64 * k, 14 * k, colors.accent);
    } else {
      for (let i = 0; i < 3; i += 1) {
        const cx = x + MARK_X[i] * k;
        let cy = top + 35 * k;
        let r = 10 * k;
        let color = state === "ready" || state === "idle" && i === 1 ? colors.accent : colors.mark;
        let alpha = 1;
        if (state === "spinning") {
          const h = hop(tSec, i * 0.16);
          cy -= 9 * h * k;
          if (h > 0.5) color = colors.accent;
        } else if (state === "research") {
          const p = think(tSec, i * 0.25);
          alpha = 0.28 + 0.72 * p;
          r *= 0.8 + 0.2 * p;
        }
        if (alpha < 1) ctx.globalAlpha = alpha;
        diamond(ctx, cx, cy, r, color);
        if (alpha < 1) ctx.globalAlpha = 1;
      }
    }
    const bubbleW = 92 * k;
    if (colors.word === null) return bubbleW;
    const wx = x + bubbleW + size * 0.36;
    setFont(ctx, colors.font, size);
    text(ctx, wordmark, wx, base, colors.word);
    const ww = measure(ctx, wordmark);
    text(ctx, ".", wx + ww, base, colors.dot);
    return wx + ww + measure(ctx, ".") - x;
  }
  var LABEL_MS = 450;
  var TOPIC_MS = 420;
  var END_DELAY_MS = 3e3;
  var END_MS = 900;
  var trackers = /* @__PURE__ */ new WeakMap();
  function labelFor(frame2, running, timeUp) {
    if (timeUp) return "done";
    if (frame2.phase === "intro") return "mode";
    if (running) return frame2.arcStep === 0 ? "s0" : frame2.arcStep === 1 ? "s1" : "s2";
    if (frame2.stage === "research") return "research";
    return "mode";
  }
  function logoFor(frame2, running, timeUp) {
    if (timeUp) return "done";
    if (running) return "speech";
    switch (frame2.stage) {
      case "spinning":
        return "spinning";
      case "research":
        return "research";
      case "landed":
      case "ready":
        return "ready";
      default:
        return "idle";
    }
  }
  function freshTracker(frame2) {
    const size = logicalSize(frame2.aspect);
    const str = stringsFor(frame2.locale);
    const scene = {
      W: size.w,
      H: size.h,
      wide: frame2.aspect === "wide",
      tSec: 0,
      str,
      modeName: "",
      durationText: "",
      running: false,
      timeUp: false,
      progress: 0,
      clockText: "00:00",
      totalClock: "00:00",
      logo: "idle",
      levels: [0.28, 0.28, 0.28],
      label: "mode",
      labelPrev: null,
      labelK: 1,
      topicKind: "blank",
      topicText: null,
      topicPrevKind: null,
      topicPrevText: null,
      topicK: 1,
      arc: 0,
      arcPrev: 0,
      arcK: 1,
      end: 0
    };
    return {
      scene,
      lastT: Number.NEGATIVE_INFINITY,
      labelAt: Number.NEGATIVE_INFINITY,
      topicAt: Number.NEGATIVE_INFINITY,
      arcAt: Number.NEGATIVE_INFINITY,
      timeUpAt: null,
      outroAt: null,
      wasRunning: false,
      elapsedVal: 0,
      elapsedAt: 0,
      modeKey: ""
    };
  }
  function sceneFor(ctx, frame2) {
    let tr2 = trackers.get(ctx);
    const first = !tr2 || frame2.t < tr2.lastT - 250 || tr2.scene.wide !== (frame2.aspect === "wide");
    if (!tr2 || first) {
      tr2 = freshTracker(frame2);
      trackers.set(ctx, tr2);
    }
    const sc = tr2.scene;
    const t = frame2.t;
    tr2.lastT = t;
    sc.tSec = t / 1e3;
    sc.str = stringsFor(frame2.locale);
    const modeKey = `${frame2.locale}|${frame2.sessionMode}|${frame2.totalSec}`;
    if (modeKey !== tr2.modeKey) {
      tr2.modeKey = modeKey;
      sc.modeName = frame2.sessionMode === "deep-research" ? sc.str.deepResearch : sc.str.offTheCuff;
      sc.durationText = sc.str.duration(frame2.totalSec);
    }
    const timeUp = frame2.phase === "overtime" || frame2.stage === "done";
    const running = !timeUp && (frame2.phase === "speech" || frame2.stage === "speech");
    sc.timeUp = timeUp;
    sc.running = running;
    const total = frame2.totalSec;
    sc.totalClock = clock(total);
    if (running) {
      if (!tr2.wasRunning || frame2.elapsedSec !== tr2.elapsedVal) {
        tr2.elapsedVal = frame2.elapsedSec;
        tr2.elapsedAt = t;
      }
      const smooth = Math.min(total, frame2.elapsedSec + clamp((t - tr2.elapsedAt) / 1e3, 0, 0.98));
      sc.progress = total > 0 ? clamp(smooth / total) : 0;
      sc.clockText = clock(Math.max(0, total - frame2.elapsedSec));
    } else if (timeUp) {
      sc.progress = 1;
      sc.clockText = clock(0);
    } else {
      sc.progress = 0;
      sc.clockText = clock(total);
    }
    tr2.wasRunning = running;
    sc.logo = logoFor(frame2, running, timeUp);
    const mic = clamp(frame2.micLevel);
    for (let i = 0; i < 3; i += 1) {
      const wobble = 0.72 + 0.28 * Math.sin(sc.tSec * (7.3 + i * 2.1) + i * 1.9);
      sc.levels[i] = 0.28 + 0.72 * clamp(mic * wobble * 1.35);
    }
    const label = labelFor(frame2, running, timeUp);
    if (first) {
      sc.label = label;
      sc.labelPrev = null;
    } else if (label !== sc.label) {
      sc.labelPrev = sc.label;
      sc.label = label;
      tr2.labelAt = t;
    }
    sc.labelK = eOut((t - tr2.labelAt) / LABEL_MS);
    if (sc.labelK >= 1) sc.labelPrev = null;
    const kind = frame2.stage === "spinning" ? "spin" : frame2.topic ? "topic" : "blank";
    const topicText = kind === "topic" ? frame2.topic : null;
    if (first) {
      sc.topicKind = kind;
      sc.topicText = topicText;
      sc.topicPrevKind = null;
      sc.topicPrevText = null;
    } else if (kind !== sc.topicKind || topicText !== sc.topicText) {
      sc.topicPrevKind = sc.topicKind;
      sc.topicPrevText = sc.topicText;
      sc.topicKind = kind;
      sc.topicText = topicText;
      tr2.topicAt = t;
    }
    sc.topicK = eOut((t - tr2.topicAt) / TOPIC_MS);
    if (sc.topicK >= 1) sc.topicPrevKind = null;
    const arc = timeUp ? 2 : running ? frame2.arcStep : 0;
    if (first) {
      sc.arc = arc;
      sc.arcPrev = arc;
    } else if (arc !== sc.arc) {
      sc.arcPrev = sc.arc;
      sc.arc = arc;
      tr2.arcAt = t;
    }
    sc.arcK = eOut((t - tr2.arcAt) / LABEL_MS);
    if (sc.arcK >= 1) sc.arcPrev = sc.arc;
    if (timeUp) {
      if (tr2.timeUpAt === null) tr2.timeUpAt = t;
    } else {
      tr2.timeUpAt = null;
    }
    if (frame2.phase === "outro") {
      if (tr2.outroAt === null) tr2.outroAt = t;
    } else {
      tr2.outroAt = null;
    }
    const endAt = Math.min(
      tr2.timeUpAt === null ? Number.POSITIVE_INFINITY : tr2.timeUpAt + END_DELAY_MS,
      tr2.outroAt === null ? Number.POSITIVE_INFINITY : tr2.outroAt
    );
    sc.end = endAt === Number.POSITIVE_INFINITY ? 0 : eInOut((t - endAt) / END_MS);
    return sc;
  }
  function minText(sc) {
    return sc.wide ? 30 : 36;
  }
  function toCompositeLayout(cache, key, aspect, output, cam, scr) {
    const base = logicalSize(aspect);
    const sx = output.w / base.w;
    const sy = output.h / base.h;
    if (sx === 1 && sy === 1) {
      let hit = cache.get(key);
      if (!hit) {
        hit = { ...cam ? { cameraRect: cam } : {}, ...scr ? { screenRect: scr } : {} };
        cache.set(key, hit);
      }
      return hit;
    }
    const scale = (r) => ({ x: r.x * sx, y: r.y * sy, w: r.w * sx, h: r.h * sy });
    return { ...cam ? { cameraRect: scale(cam) } : {}, ...scr ? { screenRect: scale(scr) } : {} };
  }

  // ../../../src/lib/compositor/styles/balon.ts
  var COB = "#173f8a";
  var DEEP = "#0d285c";
  var SHADOW = "#071736";
  var GLAZE = "#f3f7fb";
  var CORAL = "#d8402f";
  var GLAZE_22 = "rgba(243,247,251,0.22)";
  var GLAZE_60 = "rgba(243,247,251,0.6)";
  var LATTICE = "rgba(243,247,251,0.05)";
  var DEEP_25 = "rgba(13,40,92,0.25)";
  var DEEP_45 = "rgba(13,40,92,0.45)";
  var DEEP_50 = "rgba(13,40,92,0.5)";
  var CAM_TONE = "#c9d3e3";
  var SANS = "Figtree, system-ui, sans-serif";
  var SER = "Newsreader, Georgia, serif";
  var F_WORD = fontSpec(600, SER);
  var F_LABEL = fontSpec(700, SANS);
  var F_DONE = fontSpec(800, SANS);
  var F_NUM = fontSpec(700, SANS, "normal", 0.08);
  var F_TOPIC = fontSpec(700, SANS, "normal", -0.01);
  var F_DIGITS = fontSpec(500, SER, "normal", -0.04);
  var F_STEP = fontSpec(700, SANS);
  var F_STEP_DIM = fontSpec(500, SANS);
  var F_TAG = fontSpec(800, SANS);
  var F_ADDR = fontSpec(600, SANS);
  var LOGO = { bubble: GLAZE, mark: COB, accent: CORAL, word: GLAZE, dot: CORAL, font: F_WORD };
  var END_LOGO = { bubble: COB, mark: GLAZE, accent: CORAL, word: DEEP, dot: CORAL, font: F_WORD };
  var NUMS = ["01", "02", "03"];
  var RULER = { base: DEEP_25, tick: DEEP_50, bar: DEEP };
  function tailOf(h) {
    const t = Math.round(clamp(h * 0.12, 40, 90));
    return { t, tw: Math.round(t * 1.1), tx: (w) => Math.round(Math.min(w * 0.15, 180)) };
  }
  function withBubble(b) {
    return { bubble: b, cam: rect(b.x, b.y, b.w, b.h - tailOf(b.h).t) };
  }
  function build(mode, aspect) {
    if (aspect === "wide") {
      const head2 = { logo: [72, 90, 36], label: [1848, 88, 38], beads: [1464, 986, 32, 10], dir: "br" };
      if (mode === "both") {
        const scr2 = rect(72, 132, 1120, 630);
        return { ...head2, scr: scr2, ...withBubble(rect(1236, 132, 612, 780)), topic: [72, 960, 1100, 66], end: scr2, endIsScreen: true };
      }
      if (mode === "camera") {
        const tile2 = rect(1292, 292, 556, 400);
        return { ...head2, dir: "bl", ...withBubble(rect(72, 132, 1180, 748)), tile: tile2, topic: [72, 1e3, 1300, 60], end: tile2, endIsScreen: false };
      }
      const scr = rect(267, 132, 1386, 780);
      return { ...head2, scr, topic: [72, 1e3, 1300, 60], end: scr, endIsScreen: true };
    }
    const head = { logo: [120, 196, 38], label: [960, 194, 42], beads: [120, 350, 30, 9], topic: [120, 300, 840, 50], dir: "bl" };
    if (mode === "both") {
      const scr = rect(120, 392, 840, 472);
      return { ...head, scr, ...withBubble(rect(120, 902, 840, 746)), end: scr, endIsScreen: true };
    }
    if (mode === "camera") {
      const tile2 = rect(120, 1300, 840, 348);
      return { ...head, ...withBubble(rect(120, 392, 840, 880)), tile: tile2, end: tile2, endIsScreen: false };
    }
    return { ...head, scr: rect(120, 392, 840, 472), tile: rect(120, 920, 840, 440), end: rect(120, 392, 840, 968), endIsScreen: true };
  }
  var layouts = /* @__PURE__ */ new Map();
  function L(mode, aspect) {
    const key = `${mode}|${aspect}`;
    let hit = layouts.get(key);
    if (!hit) {
      hit = build(mode, aspect);
      layouts.set(key, hit);
    }
    return hit;
  }
  var composite = /* @__PURE__ */ new Map();
  function layout(mode, aspect, output, _sources) {
    const l = L(mode, aspect);
    return toCompositeLayout(composite, `${mode}|${aspect}`, aspect, output, l.cam, l.scr);
  }
  var grounds = /* @__PURE__ */ new Map();
  function paintLattice(g, W, H) {
    g.fillStyle = COB;
    g.fillRect(0, 0, W, H);
    g.fillStyle = LATTICE;
    g.beginPath();
    for (let y = 0; y <= H + 64; y += 64) {
      for (let x = 0; x <= W + 64; x += 64) {
        const cx = x + y / 64 % 2 * 32;
        g.moveTo(cx, y - 6);
        g.lineTo(cx + 6, y);
        g.lineTo(cx, y + 6);
        g.lineTo(cx - 6, y);
        g.closePath();
      }
    }
    g.fill();
  }
  function groundCanvas(W, H) {
    const key = `${W}x${H}`;
    if (grounds.has(key)) return grounds.get(key) ?? null;
    let canvas = null;
    try {
      if (typeof document !== "undefined") {
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const g = c.getContext("2d");
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
  function ground(ctx, sc, x = 0, y = 0, w = sc.W, h = sc.H) {
    const g = groundCanvas(sc.W, sc.H);
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const w0 = Math.min(sc.W, x + w) - x0;
    const h0 = Math.min(sc.H, y + h) - y0;
    if (w0 <= 0 || h0 <= 0) return;
    if (g) ctx.drawImage(g, x0, y0, w0, h0, x0, y0, w0, h0);
    else fill(ctx, x0, y0, w0, h0, COB);
  }
  function shape(ctx, r, bubble, dir, dx = 0, dy = 0) {
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
    if (dir === "br") {
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
  function edge(r) {
    return r.w < 600 ? { b: 7, sh: 10 } : { b: 9, sh: 14 };
  }
  function frame(ctx, r, bubble, dir) {
    const { b, sh } = edge(r);
    ctx.lineJoin = "miter";
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
  function drawBackground(ctx, f) {
    const sc = sceneFor(ctx, f);
    ground(ctx, sc);
    const l = L(f.mode, f.aspect);
    if (l.scr) frame(ctx, l.scr, false, l.dir);
    if (l.bubble && l.cam) {
      frame(ctx, l.bubble, true, "bl");
      fillR(ctx, l.cam, CAM_TONE);
    }
  }
  function drawLabel(ctx, sc, key, x, y, size) {
    const min = minText(sc);
    if (key === "mode") {
      setFont(ctx, F_LABEL, size - 4);
      text(ctx, sc.durationText, x, y, GLAZE, "right");
      const wa = measure(ctx, sc.durationText);
      diamond(ctx, x - wa - 20, y - size * 0.3, 7, CORAL);
      text(ctx, sc.modeName, x - wa - 40, y, GLAZE, "right");
      return;
    }
    if (key === "done") {
      setFont(ctx, F_DONE, size + 6);
      const dot = measure(ctx, ".");
      text(ctx, ".", x, y, CORAL, "right");
      text(ctx, sc.str.timeUp, x - dot, y, GLAZE, "right");
      return;
    }
    const name = key === "research" ? sc.str.research : sc.str.steps[key === "s0" ? 0 : key === "s1" ? 1 : 2];
    setFont(ctx, F_LABEL, size);
    const w = measure(ctx, name);
    text(ctx, name, x, y, GLAZE, "right");
    let left = x - w - 16;
    if (key !== "research") {
      setFont(ctx, F_NUM, min);
      const nn = NUMS[key === "s0" ? 0 : key === "s1" ? 1 : 2];
      text(ctx, nn, left, y - 2, GLAZE_60, "right");
      left -= measure(ctx, nn) + 18;
    } else {
      left -= 2;
    }
    diamond(ctx, left, y - size * 0.3, 8, CORAL);
  }
  function labelSlot(ctx, sc, l) {
    const [x, y, size] = l.label;
    if (sc.labelPrev) {
      ctx.globalAlpha = 1 - sc.labelK;
      drawLabel(ctx, sc, sc.labelPrev, x, y - 16 * sc.labelK, size);
    }
    ctx.globalAlpha = sc.labelK;
    drawLabel(ctx, sc, sc.label, x, y + 16 * (1 - sc.labelK), size);
    ctx.globalAlpha = 1;
  }
  function hopY(tSec, i) {
    const p = ((tSec - i * 0.16) / 0.48 % 1 + 1) % 1;
    if (p < 0.3) return eOut(p / 0.3);
    if (p < 0.6) return 1 - eOut((p - 0.3) / 0.3);
    return 0;
  }
  function drawTopic(ctx, sc, kind, topic, x, y, w, size) {
    const min = sc.wide ? 34 : 36;
    if (kind === "topic" && topic) {
      const f = fit(ctx, topic, F_TOPIC, w - 20, 1, size, min);
      const line = f.lines[0] ?? "";
      text(ctx, line, x, y, GLAZE);
      text(ctx, ".", x + measure(ctx, line), y, CORAL);
      return;
    }
    const small = Math.max(minText(sc), Math.round(size * 0.7));
    setFont(ctx, F_LABEL, small);
    text(ctx, sc.str.topic, x, y, GLAZE_60);
    let cx = x + measure(ctx, sc.str.topic) + 28;
    const cy = y - small * 0.32;
    if (kind === "spin") {
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
  function topicSlot(ctx, sc, l) {
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
  function beads(ctx, sc, l) {
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
  function stepColor(sc, i) {
    return (sc.running || sc.timeUp) && i <= sc.arc ? DEEP : DEEP_45;
  }
  function tile(ctx, sc, r, alpha) {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    frame(ctx, r, false, "bl");
    const { x, y, w, h } = r;
    const pad = Math.round(Math.min(w, 700) * 0.07);
    const clockColor2 = sc.timeUp ? CORAL : sc.running ? DEEP : DEEP_45;
    const min = minText(sc);
    if (sc.wide) {
      const ds = fitSize(ctx, "00:00", F_DIGITS, w - pad * 2, 150);
      setFont(ctx, F_DIGITS, ds);
      const base = y + pad + ds * 0.78;
      text(ctx, sc.clockText, x + pad - 6, base, clockColor2);
      ruler(ctx, x + pad, x + w - pad, base + 40, sc.progress, RULER, 12, 6);
      let yy = base + 40 + 52;
      for (let i = 0; i < 3; i += 1) {
        setFont(ctx, (sc.running || sc.timeUp) && i <= sc.arc ? F_STEP : F_STEP_DIM, min);
        const s = sc.str.steps[i];
        text(ctx, s, x + pad, yy, stepColor(sc, i));
        if (sc.running && i === sc.arc) fill(ctx, x + pad, yy + 7, measure(ctx, s), 3, CORAL);
        yy += min + 12;
      }
    } else {
      const ds = Math.min(150, fitSize(ctx, "00:00", F_DIGITS, w * 0.52, 150));
      setFont(ctx, F_DIGITS, ds);
      text(ctx, sc.clockText, x + pad - 6, y + (h - pad) / 2 + ds * 0.36, clockColor2);
      let yy = y + pad + 30;
      const stepSize = Math.max(min, 30);
      for (let i = 0; i < 3; i += 1) {
        setFont(ctx, (sc.running || sc.timeUp) && i <= sc.arc ? F_STEP : F_STEP_DIM, stepSize);
        const s = sc.str.steps[i];
        text(ctx, s, x + w - pad, yy, stepColor(sc, i), "right");
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
  function endCard(ctx, sc, l) {
    const e = sc.end;
    const r = l.end;
    const inA = eOut(e / 0.5);
    if (l.endIsScreen) {
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
      drawLogo(ctx, x, cy - big * 0.3, big, END_LOGO, "ready", sc.levels, sc.tSec, sc.str.wordmark);
      const tagSize = Math.max(minText(sc), Math.min(big * 0.44, fitSize(ctx, `${sc.str.tagline}.`, F_TAG, w, big * 0.44)));
      setFont(ctx, F_TAG, tagSize);
      const ty = cy + big * 0.58;
      text(ctx, sc.str.tagline, x, ty, DEEP);
      text(ctx, ".", x + measure(ctx, sc.str.tagline), ty, CORAL);
      setFont(ctx, F_ADDR, Math.max(minText(sc), Math.min(big * 0.3, fitSize(ctx, sc.str.address, F_ADDR, w, big * 0.3))));
      const ay = ty + Math.max(tagSize * 1.25, big * 0.52);
      text(ctx, sc.str.address, x, ay, COB);
      fill(ctx, x, ay + 8, measure(ctx, sc.str.address), 3, CORAL);
    }
    ctx.globalAlpha = 1;
  }
  function drawOverlays(ctx, f) {
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
  var balon = {
    id: "balon",
    labelKey: "balon",
    aspects: ["wide", "tall"],
    fonts: ["Figtree:500,600,700,800", "Newsreader:500,600"],
    layout,
    drawBackground,
    drawOverlays
  };

  // ../../../src/lib/compositor/styles/gece.ts
  var BG = "#141210";
  var CARD = "#1c1814";
  var EDGE = "rgba(242,236,225,0.14)";
  var TEXT = "#f2ece1";
  var DIM = "rgba(242,236,225,0.5)";
  var FAINT = "rgba(242,236,225,0.16)";
  var AMBER = "#e7a33e";
  var CAM_TONE2 = "#26211c";
  var GRO = "'Space Grotesk', system-ui, sans-serif";
  var MONO = "'IBM Plex Mono', ui-monospace, monospace";
  var F_WORD2 = fontSpec(700, GRO, "normal", -0.03);
  var F_MONO = fontSpec(500, MONO, "normal", 0.03);
  var F_MONO_B = fontSpec(600, MONO);
  var F_NAME = fontSpec(600, GRO);
  var F_DONE2 = fontSpec(700, GRO);
  var F_TOPIC2 = fontSpec(600, GRO, "normal", -0.01);
  var F_DIGITS2 = fontSpec(500, GRO, "normal", -0.03);
  var F_CODE = fontSpec(500, MONO);
  var F_TAG2 = fontSpec(600, GRO);
  var LOGO2 = { bubble: TEXT, mark: BG, accent: AMBER, word: TEXT, dot: AMBER, font: F_WORD2 };
  var NUMS2 = ["01", "02", "03"];
  var SLASH = " / ";
  function build2(mode, aspect) {
    if (aspect === "wide") {
      const head2 = { logo: [64, 76, 34], label: [64, 124, 34], code: [1856, 76, 34] };
      if (mode === "both") {
        return {
          ...head2,
          scr: rect(64, 146, 1120, 630),
          cam: rect(1216, 146, 640, 796),
          block: [64, 830, 1120, 56, 2],
          bar: [64, 1856, 990],
          cardList: false,
          cardTopic: false,
          end: rect(64, 146, 1120, 830)
        };
      }
      if (mode === "camera") {
        const card2 = rect(1272, 146, 584, 796);
        return { ...head2, cam: rect(64, 146, 1180, 796), card: card2, cardList: true, cardTopic: false, line: [64, 1040, 1500, 52], bar: [64, 1856, 978], end: card2 };
      }
      return {
        ...head2,
        scr: rect(64, 146, 1360, 765),
        card: rect(1456, 146, 400, 765),
        cardList: false,
        cardTopic: true,
        bar: [64, 1856, 978],
        end: rect(64, 146, 1792, 765)
      };
    }
    const head = { logo: [120, 178, 36], label: [120, 226, 36], code: [960, 178, 38], bar: [120, 960, 256], line: [120, 330, 840, 48] };
    if (mode === "both") {
      const scr = rect(120, 368, 840, 472);
      return { ...head, scr, cam: rect(120, 868, 840, 780), cardList: false, cardTopic: false, end: scr };
    }
    if (mode === "camera") {
      const card2 = rect(120, 368, 840, 412);
      return { ...head, card: card2, cam: rect(120, 808, 840, 840), cardList: false, cardTopic: false, end: card2 };
    }
    return { ...head, scr: rect(120, 368, 840, 472), card: rect(120, 872, 840, 560), cardList: true, cardTopic: false, end: rect(120, 368, 840, 1064) };
  }
  var layouts2 = /* @__PURE__ */ new Map();
  function L2(mode, aspect) {
    const key = `${mode}|${aspect}`;
    let hit = layouts2.get(key);
    if (!hit) {
      hit = build2(mode, aspect);
      layouts2.set(key, hit);
    }
    return hit;
  }
  var composite2 = /* @__PURE__ */ new Map();
  function layout2(mode, aspect, output, _sources) {
    const l = L2(mode, aspect);
    return toCompositeLayout(composite2, `${mode}|${aspect}`, aspect, output, l.cam, l.scr);
  }
  function plate(ctx, r, tone = CARD) {
    fill(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, EDGE);
    fillR(ctx, r, tone);
  }
  function drawBackground2(ctx, f) {
    const sc = sceneFor(ctx, f);
    fill(ctx, 0, 0, sc.W, sc.H, BG);
    const l = L2(f.mode, f.aspect);
    if (l.scr) plate(ctx, l.scr);
    if (l.cam) plate(ctx, l.cam, CAM_TONE2);
  }
  function drawLabel2(ctx, sc, key, x, y, size) {
    const mono = minText(sc);
    if (key === "mode") {
      setFont(ctx, F_MONO, mono);
      text(ctx, sc.modeName, x, y, AMBER);
      let xx = x + measure(ctx, sc.modeName);
      text(ctx, SLASH, xx, y, DIM);
      xx += measure(ctx, SLASH);
      text(ctx, sc.durationText, xx, y, AMBER);
      return;
    }
    if (key === "done") {
      setFont(ctx, F_DONE2, size + 2);
      text(ctx, sc.str.timeUp, x, y, AMBER);
      text(ctx, ".", x + measure(ctx, sc.str.timeUp), y, TEXT);
      return;
    }
    const nn = key === "research" ? "00" : NUMS2[key === "s0" ? 0 : key === "s1" ? 1 : 2];
    setFont(ctx, F_MONO_B, mono);
    text(ctx, nn, x, y, AMBER);
    const nw = measure(ctx, nn);
    setFont(ctx, F_NAME, size);
    text(ctx, key === "research" ? sc.str.research : sc.str.steps[key === "s0" ? 0 : key === "s1" ? 1 : 2], x + nw + 14, y, TEXT);
  }
  function labelSlot2(ctx, sc, l) {
    const [x, y, size] = l.label;
    if (sc.labelPrev) {
      ctx.globalAlpha = 1 - sc.labelK;
      drawLabel2(ctx, sc, sc.labelPrev, x, y - 14 * sc.labelK, size);
    }
    ctx.globalAlpha = sc.labelK;
    drawLabel2(ctx, sc, sc.label, x, y + 14 * (1 - sc.labelK), size);
    ctx.globalAlpha = 1;
  }
  function timecode(ctx, sc, l) {
    const [x, y, size] = l.code;
    setFont(ctx, F_CODE, size);
    const total = sc.totalClock;
    text(ctx, total, x, y, DIM, "right");
    let right = x - measure(ctx, total);
    text(ctx, SLASH, right, y, DIM, "right");
    right -= measure(ctx, SLASH);
    text(ctx, sc.clockText, right, y, sc.timeUp ? AMBER : sc.running ? TEXT : DIM, "right");
  }
  function drawTopic2(ctx, sc, kind, topic, x0, y, w0, size, lines, prefix) {
    let x = x0;
    let w = w0;
    if (kind === "topic" && topic) {
      const f = fit(ctx, topic, F_TOPIC2, w - 12, lines, size, sc.wide ? 34 : 36);
      let yy = y;
      for (const line of f.lines) {
        text(ctx, line, x, yy, TEXT);
        yy += f.size * 1.08;
      }
      return;
    }
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
    if (kind === "spin") {
      const seg = 90;
      const p = 0.5 + 0.5 * Math.sin(sc.tSec * 3.4);
      fill(ctx, x + (barW - seg) * p, barY - 3, seg, 10, AMBER);
      setFont(ctx, F_MONO, minText(sc));
      text(ctx, sc.str.drawing, x + barW + 24, y - size * 0.34 + minText(sc) * 0.36, DIM);
    } else {
      if (Math.floor(sc.tSec * 1.6) % 2 === 0) fill(ctx, x, barY - size * 0.5, 6, size * 0.62, AMBER);
    }
  }
  function topicAt(ctx, sc, x, y, w, size, lines, alpha = 1, prefix = false) {
    if (sc.topicPrevKind) {
      const a = (1 - clamp(sc.topicK * 2)) * alpha;
      if (a > 0) {
        ctx.globalAlpha = a;
        drawTopic2(ctx, sc, sc.topicPrevKind, sc.topicPrevText, x, y, w, size, lines, prefix);
      }
    }
    ctx.globalAlpha = sc.topicK * alpha;
    drawTopic2(ctx, sc, sc.topicKind, sc.topicText, x, y + 10 * (1 - sc.topicK), w, size, lines, prefix);
    ctx.globalAlpha = 1;
  }
  function topicBlock(ctx, sc, x, y, w, size, lines, alpha = 1) {
    ctx.globalAlpha = alpha;
    setFont(ctx, F_MONO, minText(sc));
    text(ctx, sc.str.topic, x, y, AMBER);
    topicAt(ctx, sc, x, y + size * 1.25, w, size, lines, alpha);
  }
  function card(ctx, sc, l, r, alpha) {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    plate(ctx, r);
    const pad = sc.wide ? 44 : 44;
    const { x, y, w, h } = r;
    const mono = minText(sc);
    const digitColor = sc.timeUp ? AMBER : sc.running ? TEXT : DIM;
    if (l.cardTopic) {
      topicBlock(ctx, sc, x + pad, y + pad + mono * 0.8, w - pad * 2, 48, 4, alpha);
      ctx.globalAlpha = alpha;
      const ds2 = fitSize(ctx, "00:00", F_DIGITS2, w - pad * 2 + 8, 150);
      setFont(ctx, F_MONO, mono);
      text(ctx, sc.str.remaining, x + pad, y + h - pad - ds2 * 0.8, AMBER);
      setFont(ctx, F_DIGITS2, ds2);
      text(ctx, sc.clockText, x + pad - 6, y + h - pad, digitColor);
      ctx.globalAlpha = 1;
      return;
    }
    setFont(ctx, F_MONO, mono);
    text(ctx, sc.str.remaining, x + pad, y + pad + mono * 0.8, AMBER);
    const ds = fitSize(ctx, "00:00", F_DIGITS2, w - pad * 2 + 8, sc.wide ? 210 : 250);
    const base = l.cardList || sc.wide ? y + pad + mono * 0.8 + ds * 0.9 : y + h - pad - 6;
    setFont(ctx, F_DIGITS2, ds);
    text(ctx, sc.clockText, x + pad - 8, base, digitColor);
    if (l.cardList) {
      const gap = sc.wide ? 58 : 62;
      const y0 = y + h - pad - 2 * gap;
      for (let i = 0; i < 3; i += 1) {
        const cur = sc.running && i === sc.arc;
        const hit = (sc.running || sc.timeUp) && i <= sc.arc;
        setFont(ctx, F_MONO_B, mono);
        text(ctx, NUMS2[i], x + pad, y0 + i * gap, cur ? AMBER : DIM);
        setFont(ctx, F_NAME, sc.wide ? 34 : 38);
        text(ctx, sc.str.steps[i], x + pad + mono * 1.9, y0 + i * gap, hit ? TEXT : DIM);
      }
    }
    ctx.globalAlpha = 1;
  }
  function endCard2(ctx, sc, r) {
    const e = sc.end;
    const inA = eOut(e / 0.45);
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
      drawLogo(ctx, x, cy - big * 0.3, big, LOGO2, "ready", sc.levels, sc.tSec, sc.str.wordmark);
      const tag = Math.max(minText(sc), Math.min(big * 0.42, fitSize(ctx, `${sc.str.tagline}.`, F_TAG2, w, big * 0.42)));
      setFont(ctx, F_TAG2, tag);
      const ty = cy + big * 0.56;
      text(ctx, sc.str.tagline, x, ty, TEXT);
      text(ctx, ".", x + measure(ctx, sc.str.tagline), ty, AMBER);
      setFont(ctx, F_CODE, Math.max(minText(sc), Math.min(big * 0.3, fitSize(ctx, sc.str.address, F_CODE, w, big * 0.3))));
      text(ctx, sc.str.address, x, ty + Math.max(tag * 1.3, big * 0.5), AMBER);
    }
    ctx.globalAlpha = 1;
  }
  function drawOverlays2(ctx, f) {
    const sc = sceneFor(ctx, f);
    const l = L2(f.mode, f.aspect);
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
    drawLogo(ctx, lx, ly, ls, LOGO2, sc.logo, sc.levels, sc.tSec, sc.str.wordmark);
    labelSlot2(ctx, sc, l);
    timecode(ctx, sc, l);
    const [b0, b1, by] = l.bar;
    fill(ctx, b0, by - 1, b1 - b0, 2, FAINT);
    fill(ctx, b0, by - 2, (b1 - b0) * sc.progress, 4, AMBER);
    if (sc.end > 0) endCard2(ctx, sc, l.end);
  }
  var gece = {
    id: "gece",
    labelKey: "gece",
    aspects: ["wide", "tall"],
    fonts: ["Space Grotesk:500,600,700", "IBM Plex Mono:500,600"],
    layout: layout2,
    drawBackground: drawBackground2,
    drawOverlays: drawOverlays2
  };

  // ../../../src/lib/compositor/styles/izgara.ts
  var LINE = "#111111";
  var CELL = "#f5f3ee";
  var RED = "#d93a26";
  var BLUE = "#1f3d94";
  var YEL = "#f1c21b";
  var INK = "#111111";
  var INK_40 = "rgba(17,17,17,0.4)";
  var CAM_TONE3 = "#3a3834";
  var SCR_TONE = "#e9e6de";
  var G = 12;
  var BIG = "'Big Shoulders Display', 'Arial Narrow', sans-serif";
  var SANS2 = "'Instrument Sans', system-ui, sans-serif";
  var F_BIG = fontSpec(900, BIG, "normal", -0.01);
  var F_WORD3 = fontSpec(700, SANS2);
  var F_BOLD = fontSpec(700, SANS2);
  var F_MED = fontSpec(500, SANS2);
  var F_SEMI = fontSpec(600, SANS2);
  var F_TOPIC3 = fontSpec(700, SANS2, "normal", -0.01);
  var LOGO3 = { bubble: CELL, mark: BLUE, accent: YEL, word: CELL, dot: YEL, font: F_WORD3 };
  var NUMS3 = ["01", "02", "03"];
  var ROT = [
    [RED, YEL],
    [BLUE, RED],
    [RED, BLUE]
  ];
  var SPLIT_WIDE = [0.644, 0.47, 0.743];
  var SPLIT_TALL = [0.5, 0.37, 0.574];
  function build3(mode, aspect) {
    if (aspect === "wide") {
      if (mode === "both") {
        const scr3 = rect(1112, 0, 808, 454);
        return {
          cam: rect(0, 0, 1100, 1080),
          scr: scr3,
          topicCell: rect(1112, 466, 808, 190),
          band: rect(1112, 668, 808, 280),
          brand: rect(1112, 960, 420, 120),
          blockB: rect(1544, 960, 376, 120),
          blockBVertical: false,
          end: scr3,
          logo: [1142, 1036, 38]
        };
      }
      if (mode === "camera") {
        const timer = rect(1112, 0, 808, 656);
        return {
          cam: rect(0, 0, 1100, 1080),
          timer,
          band: rect(1112, 668, 808, 280),
          brand: rect(1112, 960, 420, 120),
          blockB: rect(1544, 960, 376, 120),
          blockBVertical: false,
          end: timer,
          logo: [1142, 1036, 38]
        };
      }
      const scr2 = rect(0, 0, 1440, 810);
      return {
        scr: scr2,
        bigTopic: rect(1452, 0, 468, 560),
        clockCell: rect(1452, 572, 468, 238),
        band: rect(0, 822, 1440, 258),
        brand: rect(1452, 822, 468, 258),
        blockBVertical: false,
        end: scr2,
        logo: [1484, 966, 42]
      };
    }
    const top = { band: rect(0, 0, 1080, 250), sideA: rect(0, 262, 108, 540), logo: [120, 196, 38] };
    if (mode === "both") {
      const scr2 = rect(120, 262, 960, 540);
      return { ...top, scr: scr2, topicCell: rect(0, 814, 1080, 150), cam: rect(0, 976, 1080, 944), blockBVertical: false, end: scr2 };
    }
    if (mode === "camera") {
      const timer = rect(120, 262, 960, 540);
      return { ...top, timer, cam: rect(0, 814, 1080, 1106), blockBVertical: false, end: timer };
    }
    const scr = rect(120, 262, 960, 540);
    return {
      ...top,
      scr,
      bigTopic: rect(0, 814, 1080, 400),
      blockB: rect(0, 1226, 108, 694),
      blockBVertical: true,
      clockCell: rect(120, 1226, 960, 694),
      end: scr
    };
  }
  var layouts3 = /* @__PURE__ */ new Map();
  function L3(mode, aspect) {
    const key = `${mode}|${aspect}`;
    let hit = layouts3.get(key);
    if (!hit) {
      hit = build3(mode, aspect);
      layouts3.set(key, hit);
    }
    return hit;
  }
  var composite3 = /* @__PURE__ */ new Map();
  function layout3(mode, aspect, output, _sources) {
    const l = L3(mode, aspect);
    return toCompositeLayout(composite3, `${mode}|${aspect}`, aspect, output, l.cam, l.scr);
  }
  function drawBackground3(ctx, f) {
    const sc = sceneFor(ctx, f);
    fill(ctx, 0, 0, sc.W, sc.H, LINE);
    const l = L3(f.mode, f.aspect);
    if (l.cam) fillR(ctx, l.cam, CAM_TONE3);
    if (l.scr) fillR(ctx, l.scr, SCR_TONE);
  }
  function rightEdge(sc, r, pad) {
    return sc.wide ? r.x + r.w - pad : Math.min(TALL_SAFE.x1, r.x + r.w - pad);
  }
  function leftEdge(sc, r, pad) {
    return sc.wide ? r.x + pad : Math.max(TALL_SAFE.x0, r.x + pad);
  }
  function clip(ctx, r) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
  }
  function block(ctx, r, prev, cur, k, vertical) {
    fillR(ctx, r, prev);
    if (prev === cur || k >= 1) {
      if (k >= 1) fillR(ctx, r, cur);
      return;
    }
    if (vertical) fill(ctx, r.x, r.y + r.h * (1 - k), r.w, r.h * k, cur);
    else fill(ctx, r.x, r.y, r.w * k, r.h, cur);
  }
  function drawStepLabel(ctx, sc, key, r, dy) {
    const { x, y, w, h } = r;
    const nx = leftEdge(sc, r, sc.wide ? 28 : 26);
    const right = rightEdge(sc, r, 20);
    const min = minText(sc);
    if (key === "mode") {
      const size = Math.max(min, Math.min(44, fitSize(ctx, sc.modeName, F_BOLD, right - nx, 44)));
      setFont(ctx, F_BOLD, size);
      const y1 = sc.wide ? y + h * 0.46 : y + h - 34 - size * 1.25;
      text(ctx, sc.modeName, nx, y1 + dy, INK);
      setFont(ctx, F_MED, size);
      text(ctx, sc.durationText, nx, y1 + size * 1.25 + dy, INK);
      return;
    }
    if (key === "done") {
      const size = Math.min(sc.wide ? 150 : 110, h * 0.6, fitSize(ctx, `${sc.str.timeUp}.`, F_BIG, right - nx, 150));
      setFont(ctx, F_BIG, size);
      const by = y + h - (sc.wide ? 40 : 34) + dy;
      text(ctx, sc.str.timeUp, nx, by, INK);
      text(ctx, ".", nx + measure(ctx, sc.str.timeUp), by, RED);
      return;
    }
    if (key === "research") {
      const size = Math.min(sc.wide ? 150 : 110, h * 0.6, fitSize(ctx, sc.str.research, F_BIG, right - nx, 150));
      setFont(ctx, F_BIG, size);
      text(ctx, sc.str.research, nx, y + h - (sc.wide ? 40 : 34) + dy, INK);
      return;
    }
    const i = key === "s0" ? 0 : key === "s1" ? 1 : 2;
    const name = sc.str.steps[i];
    if (sc.wide) {
      const f2 = fit(ctx, name, F_BOLD, right - nx, 2, 38, min);
      for (let j = 0; j < f2.lines.length; j += 1) text(ctx, f2.lines[j], nx, y + 62 + j * f2.size * 1.16 + dy, INK);
      setFont(ctx, F_BIG, Math.min(190, h * 0.66));
      text(ctx, NUMS3[i], nx, y + h - 30 + dy, INK);
      return;
    }
    setFont(ctx, F_BIG, 120);
    text(ctx, NUMS3[i], nx, y + h - 34 + dy, INK);
    const nw = measure(ctx, NUMS3[i]);
    const f = fit(ctx, name, F_BOLD, right - (nx + nw + 18), 2, 40, min);
    const lines = f.lines.length;
    for (let j = 0; j < lines; j += 1) {
      text(ctx, f.lines[j], nx + nw + 18, y + h - 44 - (lines - 1 - j) * f.size * 1.08 + dy, INK);
    }
  }
  function stepCell(ctx, sc, r) {
    fillR(ctx, r, CELL);
    fill(ctx, r.x, r.y, r.w * sc.progress, r.h, YEL);
    clip(ctx, r);
    if (sc.labelPrev) drawStepLabel(ctx, sc, sc.labelPrev, r, -r.h * sc.labelK);
    drawStepLabel(ctx, sc, sc.label, r, r.h * (1 - sc.labelK));
    ctx.restore();
  }
  function hopY2(tSec, i) {
    const p = ((tSec - i * 0.16) / 0.48 % 1 + 1) % 1;
    if (p < 0.3) return eOut(p / 0.3);
    if (p < 0.6) return 1 - eOut((p - 0.3) / 0.3);
    return 0;
  }
  function drawTopic3(ctx, sc, kind, topic, x, y, w, lines, size, anchorBottom, prefix) {
    if (kind === "topic" && topic) {
      const f = fit(ctx, topic, F_TOPIC3, w, lines, size, sc.wide ? 34 : 36);
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
    if (kind === "spin") {
      for (let i = 0; i < 3; i += 1) {
        const hgt = hopY2(sc.tSec, i);
        fill(ctx, bx + i * 34, y - 24 - 12 * hgt, 22, 22, hgt > 0.5 ? RED : YEL);
      }
      setFont(ctx, F_MED, min);
      text(ctx, sc.str.drawing, bx + 3 * 34 + 10, y, INK);
      return;
    }
    fill(ctx, bx, y - 14, Math.min(w * 0.45, 380), 14, INK);
  }
  function topicSlot2(ctx, sc, x, y, w, lines, size, anchorBottom = false, prefix = true) {
    if (sc.topicPrevKind) {
      const a = 1 - clamp(sc.topicK * 2);
      if (a > 0) {
        ctx.globalAlpha = a;
        drawTopic3(ctx, sc, sc.topicPrevKind, sc.topicPrevText, x, y, w, lines, size, anchorBottom, prefix);
      }
    }
    ctx.globalAlpha = sc.topicK;
    drawTopic3(ctx, sc, sc.topicKind, sc.topicText, x, y + 10 * (1 - sc.topicK), w, lines, size, anchorBottom, prefix);
    ctx.globalAlpha = 1;
  }
  function clockColor(sc) {
    return sc.timeUp ? RED : sc.running ? INK : INK_40;
  }
  function timerCell(ctx, sc, r) {
    fillR(ctx, r, CELL);
    const pad = sc.wide ? 34 : 30;
    const x = leftEdge(sc, r, pad);
    const right = rightEdge(sc, r, pad);
    topicSlot2(ctx, sc, x, r.y + pad + 56, right - x, 2, 56);
    const ds = fitSize(ctx, "00:00", F_BIG, right - x + 8, sc.wide ? 300 : 330);
    setFont(ctx, F_BIG, ds);
    text(ctx, sc.clockText, x - 8, r.y + r.h - pad + 6, clockColor(sc));
  }
  function topicCell(ctx, sc, r) {
    fillR(ctx, r, CELL);
    const x = leftEdge(sc, r, 34);
    const right = rightEdge(sc, r, 34);
    const size = sc.wide ? 50 : 52;
    const f = sc.topicKind === "topic" && sc.topicText ? fit(ctx, sc.topicText, F_TOPIC3, right - x, 2, size, sc.wide ? 34 : 36) : null;
    const n = f ? f.lines.length : 1;
    const s = f ? f.size : size;
    const y = r.y + r.h / 2 + s * 0.35 - (n - 1) * s * 1.04 / 2;
    topicSlot2(ctx, sc, x, y, right - x, 2, size);
  }
  function bigTopicCell(ctx, sc, r) {
    fillR(ctx, r, CELL);
    const x = leftEdge(sc, r, 34);
    const right = rightEdge(sc, r, 34);
    setFont(ctx, F_SEMI, minText(sc));
    text(ctx, sc.str.topic, x, r.y + 66, INK);
    topicSlot2(ctx, sc, x, r.y + r.h - 40, right - x, sc.wide ? 4 : 3, 96, true, false);
  }
  function clockCell(ctx, sc, r) {
    fillR(ctx, r, CELL);
    const pad = 34;
    const x = leftEdge(sc, r, pad);
    const right = rightEdge(sc, r, pad);
    const bottom = sc.wide ? r.y + r.h - pad + 6 : Math.min(TALL_SAFE.y1 - 20, r.y + r.h - pad);
    const ds = Math.min(fitSize(ctx, "00:00", F_BIG, right - x + 8, sc.wide ? 200 : 330), (bottom - r.y - pad) * 1.15);
    setFont(ctx, F_BIG, ds);
    text(ctx, sc.clockText, x - 6, bottom, clockColor(sc));
  }
  function endCell(ctx, sc, r) {
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
    drawLogo(ctx, x, base, logoSize, LOGO3, "ready", sc.levels, sc.tSec, sc.str.wordmark);
    const f = fit(ctx, `${sc.str.tagline}.`, F_BOLD, right - x, 2, large ? 64 : 44, minText(sc));
    for (let i = 0; i < f.lines.length; i += 1) text(ctx, f.lines[i], x, base + logoSize * 1.05 + i * f.size * 1.18, CELL);
    setFont(ctx, F_SEMI, Math.max(minText(sc), Math.min(34, fitSize(ctx, sc.str.address, F_SEMI, right - x, 34))));
    text(ctx, sc.str.address, x, r.y + r.h - pad, YEL);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function drawOverlays3(ctx, f) {
    const sc = sceneFor(ctx, f);
    const l = L3(f.mode, f.aspect);
    if (l.timer) timerCell(ctx, sc, l.timer);
    if (l.topicCell) topicCell(ctx, sc, l.topicCell);
    if (l.bigTopic) bigTopicCell(ctx, sc, l.bigTopic);
    if (l.clockCell) clockCell(ctx, sc, l.clockCell);
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
      fill(ctx, band.x, band.y, split, band.h, BLUE);
      stepCell(ctx, sc, rect(band.x + split + G, band.y, band.w - split - G, band.h));
      if (l.sideA) block(ctx, l.sideA, cPrev[0], cCur[0], sc.arcK, true);
      if (l.blockB) block(ctx, l.blockB, cPrev[1], cCur[1], sc.arcK, l.blockBVertical);
    }
    const [lx, ly, ls] = l.logo;
    drawLogo(ctx, lx, ly, ls, LOGO3, sc.logo, sc.levels, sc.tSec, sc.str.wordmark);
    if (sc.end > 0) endCell(ctx, sc, l.end);
  }
  var izgara = {
    id: "izgara",
    labelKey: "izgara",
    aspects: ["wide", "tall"],
    fonts: ["Big Shoulders Display:700,900", "Instrument Sans:500,600,700"],
    layout: layout3,
    drawBackground: drawBackground3,
    drawOverlays: drawOverlays3
  };

  // ../../../src/lib/compositor/styles/kagit.ts
  var PAPER = "#f3eee2";
  var INK2 = "#1d1a16";
  var PENCIL = "#6f695c";
  var RULE = "#d6cfbf";
  var BLANK = "#b3aa96";
  var RED2 = "#b8281c";
  var CAM_TONE4 = "#dcd4c3";
  var SCR_TONE2 = "#e7e1d3";
  var SER2 = "Newsreader, Georgia, serif";
  var F_WORD4 = fontSpec(600, SER2);
  var F_LABEL2 = fontSpec(600, SER2);
  var F_NUM2 = fontSpec(500, SER2);
  var F_ITALIC = fontSpec(400, SER2, "italic");
  var F_TOPIC4 = fontSpec(700, SER2, "normal", -0.02);
  var F_CAPTION = fontSpec(600, SER2, "normal", -0.01);
  var F_DIGITS3 = fontSpec(500, SER2, "normal", -0.04);
  var F_TAG3 = fontSpec(600, SER2);
  var F_ADDR2 = fontSpec(400, SER2);
  var LOGO4 = { bubble: INK2, mark: PAPER, accent: RED2, word: INK2, dot: RED2, font: F_WORD4 };
  var NUMS4 = ["01", "02", "03"];
  var RULER2 = { base: RULE, tick: PENCIL, bar: INK2 };
  var DOTS = ["", ".", "..", "..."];
  function build4(mode, aspect) {
    if (aspect === "wide") {
      const head2 = { logo: [64, 90, 40], label: [1856, 90, 36], ruler: [64, 1856, 128] };
      if (mode === "both") {
        return {
          ...head2,
          scr: rect(64, 164, 1100, 619),
          cap: rect(64, 812, 1100, 204),
          capLines: 2,
          capSize: 64,
          cam: rect(1196, 164, 660, 852),
          colLines: 0,
          colSize: 0,
          colClock: 0,
          end: rect(64, 164, 1100, 852)
        };
      }
      if (mode === "camera") {
        return {
          ...head2,
          col: rect(64, 164, 640, 852),
          colLines: 3,
          colSize: 88,
          colClock: 230,
          cam: rect(736, 164, 1120, 852),
          capLines: 0,
          capSize: 0,
          end: rect(64, 164, 640, 852)
        };
      }
      return {
        ...head2,
        scr: rect(64, 164, 1360, 765),
        col: rect(1464, 164, 392, 852),
        colLines: 4,
        colSize: 64,
        colClock: 170,
        capLines: 0,
        capSize: 0,
        end: rect(64, 164, 1792, 852)
      };
    }
    const head = { logo: [120, 196, 40], label: [960, 196, 40], ruler: [120, 960, 236] };
    if (mode === "both") {
      return {
        ...head,
        scr: rect(120, 272, 840, 472),
        cap: rect(120, 764, 840, 136),
        capLines: 1,
        capSize: 60,
        cam: rect(120, 914, 840, 746),
        colLines: 0,
        colSize: 0,
        colClock: 0,
        end: rect(120, 272, 840, 628)
      };
    }
    if (mode === "camera") {
      return {
        ...head,
        col: rect(120, 272, 840, 452),
        colLines: 2,
        colSize: 76,
        colClock: 220,
        cam: rect(120, 756, 840, 904),
        capLines: 0,
        capSize: 0,
        end: rect(120, 272, 840, 452)
      };
    }
    return {
      ...head,
      scr: rect(120, 272, 840, 472),
      col: rect(120, 784, 840, 640),
      colLines: 3,
      colSize: 88,
      colClock: 280,
      capLines: 0,
      capSize: 0,
      end: rect(120, 272, 840, 1152)
    };
  }
  var layouts4 = /* @__PURE__ */ new Map();
  function L4(mode, aspect) {
    const key = `${mode}|${aspect}`;
    let hit = layouts4.get(key);
    if (!hit) {
      hit = build4(mode, aspect);
      layouts4.set(key, hit);
    }
    return hit;
  }
  var composite4 = /* @__PURE__ */ new Map();
  function layout4(mode, aspect, output, _sources) {
    const l = L4(mode, aspect);
    return toCompositeLayout(composite4, `${mode}|${aspect}`, aspect, output, l.cam, l.scr);
  }
  function drawBackground4(ctx, frame2) {
    const sc = sceneFor(ctx, frame2);
    fill(ctx, 0, 0, sc.W, sc.H, PAPER);
    const l = L4(frame2.mode, frame2.aspect);
    if (l.scr) {
      fill(ctx, l.scr.x - 2, l.scr.y - 2, l.scr.w + 4, l.scr.h + 4, RULE);
      fillR(ctx, l.scr, SCR_TONE2);
    }
    if (l.cam) fillR(ctx, l.cam, CAM_TONE4);
  }
  function drawLabel3(ctx, sc, key, x, y, size) {
    if (key === "mode") {
      setFont(ctx, F_ITALIC, size);
      text(ctx, sc.durationText, x, y, PENCIL, "right");
      let right = x - measure(ctx, sc.durationText);
      text(ctx, " \xB7 ", right, y, PENCIL, "right");
      right -= measure(ctx, " \xB7 ");
      text(ctx, sc.modeName, right, y, PENCIL, "right");
      return;
    }
    if (key === "done") {
      setFont(ctx, F_LABEL2, size + 4);
      const dot = measure(ctx, ".");
      text(ctx, sc.str.timeUp, x - dot, y, INK2, "right");
      text(ctx, ".", x, y, RED2, "right");
      return;
    }
    const name = key === "research" ? sc.str.research : sc.str.steps[key === "s0" ? 0 : key === "s1" ? 1 : 2];
    setFont(ctx, F_LABEL2, size);
    const w = measure(ctx, name);
    text(ctx, name, x, y, INK2, "right");
    fill(ctx, x - w, y + 8, w, 3, key === "research" ? PENCIL : RED2);
    if (key !== "research") {
      setFont(ctx, F_NUM2, Math.max(minText(sc), size * 0.8));
      text(ctx, NUMS4[key === "s0" ? 0 : key === "s1" ? 1 : 2], x - w - 16, y, PENCIL, "right");
    }
  }
  function labelSlot3(ctx, sc, l) {
    const [x, y, size] = l.label;
    if (sc.labelPrev) {
      ctx.globalAlpha = 1 - sc.labelK;
      drawLabel3(ctx, sc, sc.labelPrev, x, y - 16 * sc.labelK, size);
    }
    ctx.globalAlpha = sc.labelK;
    drawLabel3(ctx, sc, sc.label, x, y + 16 * (1 - sc.labelK), size);
    ctx.globalAlpha = 1;
  }
  function drawTopic4(ctx, sc, kind, topic, x, y, w, lines, size, min) {
    if (kind === "topic" && topic) {
      const f = fit(ctx, topic, F_TOPIC4, w - 16, lines, size, min);
      let yy = y;
      for (let i = 0; i < f.lines.length; i += 1) {
        text(ctx, f.lines[i], x, yy, INK2);
        if (i === f.lines.length - 1) text(ctx, ".", x + measure(ctx, f.lines[i]), yy, RED2);
        yy += f.size * 0.98;
      }
      return;
    }
    const lineW = Math.min(w, Math.max(260, w * 0.62));
    fill(ctx, x, y + 6, lineW, 3, BLANK);
    if (kind === "spin") {
      const seg = lineW * 0.24;
      const p = 0.5 + 0.5 * Math.sin(sc.tSec * 3.6);
      fill(ctx, x + (lineW - seg) * p, y + 5, seg, 5, INK2);
      setFont(ctx, F_ITALIC, Math.max(minText(sc), size * 0.5));
      text(ctx, sc.str.drawing, x, y - size * 0.12, PENCIL);
      const dots = DOTS[Math.floor(sc.tSec * 2.5) % 4];
      if (dots) text(ctx, dots, x + measure(ctx, sc.str.drawing), y - size * 0.12, PENCIL);
    }
  }
  function topicSlot3(ctx, sc, x, y, w, lines, size, min) {
    if (sc.topicPrevKind) {
      const a = 1 - clamp(sc.topicK * 2);
      if (a > 0) {
        ctx.globalAlpha = a;
        drawTopic4(ctx, sc, sc.topicPrevKind, sc.topicPrevText, x, y, w, lines, size, min);
      }
    }
    ctx.globalAlpha = sc.topicK;
    drawTopic4(ctx, sc, sc.topicKind, sc.topicText, x, y + 12 * (1 - sc.topicK), w, lines, size, min);
    ctx.globalAlpha = 1;
  }
  function caption(ctx, sc, r, lines, size) {
    const labelSize = minText(sc);
    setFont(ctx, F_ITALIC, labelSize);
    text(ctx, sc.str.topic, r.x, r.y + labelSize, PENCIL);
    topicSlot3(ctx, sc, r.x, r.y + labelSize + size * 1.05, r.w, lines, size, 40);
  }
  function column(ctx, sc, l, r) {
    caption(ctx, sc, r, l.colLines, l.colSize);
    const size = fitSize(ctx, "00:00", F_DIGITS3, r.w, l.colClock);
    setFont(ctx, F_DIGITS3, size);
    text(ctx, sc.clockText, r.x - (sc.wide ? size * 0.03 : 0), r.y + r.h - 6, sc.running || sc.timeUp ? INK2 : PENCIL);
  }
  function endCard3(ctx, sc, r) {
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
    drawLogo(ctx, x, cy - big * 0.35 + dy, big, LOGO4, "ready", sc.levels, sc.tSec, sc.str.wordmark);
    const tagSize = Math.min(big * 0.46, fitSize(ctx, `${sc.str.tagline}.`, F_TAG3, w, big * 0.46));
    setFont(ctx, F_TAG3, tagSize);
    const ty = cy + big * 0.55 + dy;
    text(ctx, sc.str.tagline, x, ty, INK2);
    text(ctx, ".", x + measure(ctx, sc.str.tagline), ty, RED2);
    setFont(ctx, F_ADDR2, Math.max(minText(sc), big * 0.32));
    const ay = cy + big * 1.12 + dy;
    text(ctx, sc.str.address, x, ay, PENCIL);
    fill(ctx, x, ay + 8, measure(ctx, sc.str.address), 2, RULE);
    ctx.globalAlpha = 1;
  }
  function drawOverlays4(ctx, frame2) {
    const sc = sceneFor(ctx, frame2);
    const l = L4(frame2.mode, frame2.aspect);
    if (l.cap) caption(ctx, sc, l.cap, l.capLines, l.capSize);
    if (l.col) column(ctx, sc, l, l.col);
    const [lx, ly, ls] = l.logo;
    drawLogo(ctx, lx, ly, ls, LOGO4, sc.logo, sc.levels, sc.tSec, sc.str.wordmark);
    labelSlot3(ctx, sc, l);
    const [r0, r1, ry] = l.ruler;
    ruler(ctx, r0, r1, ry, sc.progress, RULER2, 14, 6);
    if (sc.end > 0) endCard3(ctx, sc, l.end);
  }
  var kagit = {
    id: "kagit",
    labelKey: "kagit",
    aspects: ["wide", "tall"],
    fonts: ["Newsreader:400,400i,500,600,700"],
    layout: layout4,
    drawBackground: drawBackground4,
    drawOverlays: drawOverlays4
  };

  // ../../../src/lib/compositor/styles/index.ts
  var COMPOSITE_STYLES = [kagit, balon, gece, izgara];
  var DEFAULT_STYLE_ID = COMPOSITE_STYLES[0].id;

  // ../../../src/lib/compositor/fonts.ts
  var SITE_FAMILIES = /* @__PURE__ */ new Set(["Newsreader"]);
  var FONT_SAMPLE = "irticalen s\xFCre. \u0131\u011F\xFC\u015F\xF6\xE7 \u0130\u011E\xDC\u015E\xD6\xC7 0123456789:\xB7/?";
  var DEFAULT_TIMEOUT_MS = 8e3;
  function parseFontSpec(spec) {
    const colon = spec.lastIndexOf(":");
    const family = (colon >= 0 ? spec.slice(0, colon) : spec).trim();
    if (!family) return [];
    const list = colon >= 0 ? spec.slice(colon + 1) : "400";
    const faces = [];
    for (const part of list.split(",")) {
      const token = part.trim();
      const italic = token.endsWith("i");
      const weight = Number.parseInt(italic ? token.slice(0, -1) : token, 10);
      if (!Number.isFinite(weight) || weight < 100 || weight > 900) continue;
      if (!faces.some((f) => f.weight === weight && f.italic === italic)) faces.push({ family, weight, italic });
    }
    return faces;
  }
  function fontDescriptors(specs) {
    const out = [];
    for (const spec of specs) {
      for (const face of parseFontSpec(spec)) {
        out.push(`${face.italic ? "italic " : ""}${face.weight} 40px "${face.family}"`);
      }
    }
    return out;
  }
  function googleFontsHref(specs) {
    const params = [];
    const seen = /* @__PURE__ */ new Set();
    for (const spec of specs) {
      const faces = parseFontSpec(spec);
      if (faces.length === 0) continue;
      const family = faces[0].family;
      if (SITE_FAMILIES.has(family) || seen.has(family)) continue;
      seen.add(family);
      const name = family.replace(/ /g, "+");
      const hasItalic = faces.some((f) => f.italic);
      const sorted = [...faces].sort((a, b) => Number(a.italic) - Number(b.italic) || a.weight - b.weight);
      if (hasItalic) {
        params.push(`family=${name}:ital,wght@${sorted.map((f) => `${f.italic ? 1 : 0},${f.weight}`).join(";")}`);
      } else {
        params.push(`family=${name}:wght@${sorted.map((f) => f.weight).join(";")}`);
      }
    }
    if (params.length === 0) return null;
    return `https://fonts.googleapis.com/css2?${params.join("&")}&display=block`;
  }
  var stylesheetLoads = /* @__PURE__ */ new Map();
  function addStylesheet(doc, href) {
    const known = stylesheetLoads.get(href);
    if (known) return known;
    const promise = new Promise((resolve) => {
      const existing = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).find((l) => l.href === href);
      if (existing) {
        resolve();
        return;
      }
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.irticalenFonts = "";
      link.addEventListener("load", () => resolve(), { once: true });
      link.addEventListener("error", () => resolve(), { once: true });
      doc.head.appendChild(link);
    });
    stylesheetLoads.set(href, promise);
    void promise.then(() => {
      const ok = Array.from(doc.styleSheets).some((s) => s.href === href);
      if (!ok) stylesheetLoads.delete(href);
    });
    return promise;
  }
  function withTimeout(promise, ms, fallback) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(fallback), ms);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        () => {
          clearTimeout(timer);
          resolve(fallback);
        }
      );
    });
  }
  async function ensureFonts(specs, options = {}) {
    const doc = options.doc ?? (typeof document === "undefined" ? void 0 : document);
    if (!doc || !doc.fonts || specs.length === 0) return specs.length === 0;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const run = async () => {
      const href = googleFontsHref(specs);
      if (href) await addStylesheet(doc, href);
      const descriptors = fontDescriptors(specs);
      const loaded = await Promise.all(descriptors.map((d) => doc.fonts.load(d, FONT_SAMPLE).catch(() => [])));
      const ok = descriptors.every((d, i) => {
        try {
          return loaded[i].length > 0 && doc.fonts.check(d, FONT_SAMPLE);
        } catch {
          return false;
        }
      });
      invalidateTextCache();
      return ok;
    };
    return withTimeout(run(), timeoutMs, false);
  }
  function ensureStyleFonts(style, options) {
    return ensureFonts(style.fonts ?? [], options);
  }

  // ../../../src/lib/compositor/styles/placeholders.ts
  var AVATAR_GROUND = "#e4e4e2";
  var AVATAR_FIGURE = "#a3a3a0";
  function drawAvatar(ctx, r) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.fillStyle = AVATAR_GROUND;
    ctx.fillRect(r.x, r.y, r.w, r.h);
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
  function drawScreenPlaceholder(ctx, r) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.fillStyle = "#f7f7f5";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const u = r.w / 100;
    const barH = Math.max(4, u * 3.4);
    ctx.fillStyle = "#e2e2df";
    ctx.fillRect(r.x, r.y, r.w, barH);
    ctx.fillStyle = "#c4c4c0";
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(r.x + u * (2.4 + i * 2.2), r.y + barH / 2, u * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
    const left = r.x + u * 8;
    let y = r.y + barH + u * 6;
    ctx.fillStyle = "#9b9b97";
    ctx.fillRect(left, y, u * 34, u * 2.6);
    y += u * 7;
    ctx.fillStyle = "#d3d3cf";
    const widths = [78, 70, 82, 44, 0, 74, 80, 58];
    for (const w of widths) {
      if (w > 0 && y + u * 1.4 < r.y + r.h - u * 4) ctx.fillRect(left, y, u * w, u * 1.4);
      y += u * 4.2;
    }
    ctx.restore();
  }

  // ../../../src/lib/timer.ts
  function speechArcStep(elapsedSec, totalSec) {
    if (totalSec <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, elapsedSec / totalSec));
    if (ratio < 1 / 3) return 0;
    if (ratio < 2 / 3) return 1;
    return 2;
  }

  // harness.ts
  var TOTAL = 180;
  var SPEECH_AT = 14e3;
  var DONE_AT = SPEECH_AT + TOTAL * 1e3;
  function frameAt(t, mode, aspect, s) {
    let stage = "idle";
    let topic = null;
    if (t >= s.spinAt) stage = "spinning";
    if (t >= s.topicAt) {
      stage = s.research ? "research" : "landed";
      topic = s.locale === "en" ? "the sunk cost fallacy" : "bat\u0131k maliyet yan\u0131lg\u0131s\u0131";
    }
    let elapsed = 0;
    if (t >= SPEECH_AT) {
      stage = "speech";
      elapsed = Math.min(TOTAL, Math.floor((t - SPEECH_AT) / 1e3));
    }
    if (t >= DONE_AT) {
      stage = "done";
      elapsed = TOTAL;
    }
    let phase = t < 3e3 ? "intro" : stage === "speech" ? "speech" : stage === "done" ? "overtime" : "pre";
    if (s.stopAt !== null && t >= s.stopAt) phase = "outro";
    return {
      t,
      topic,
      locale: s.locale,
      phase,
      stage,
      sessionMode: s.research ? "deep-research" : "off-the-cuff",
      elapsedSec: elapsed,
      totalSec: TOTAL,
      arcStep: speechArcStep(elapsed, TOTAL),
      micLevel: stage === "speech" ? 0.5 + 0.4 * Math.sin(t / 97) * Math.cos(t / 331) : 0,
      mode,
      aspect
    };
  }
  function render(styleId, mode, aspect, at, s, outW, safe = false) {
    const style = COMPOSITE_STYLES.find((x) => x.id === styleId);
    const W = aspect === "wide" ? 1920 : 1080, H = aspect === "wide" ? 1080 : 1920;
    const c = document.createElement("canvas");
    c.width = outW;
    c.height = Math.round(outW * H / W);
    const ctx = c.getContext("2d");
    const k = outW / W;
    const out = { w: W, h: H };
    for (let t = Math.max(0, at - 5e3); t <= at; t += 33) {
      const f = frameAt(t, mode, aspect, s);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      style.drawBackground(ctx, f);
      const r = style.layout(mode, aspect, out, {});
      if (r.screenRect) drawScreenPlaceholder(ctx, r.screenRect);
      if (r.cameraRect) drawAvatar(ctx, r.cameraRect);
      style.drawOverlays(ctx, f);
    }
    if (safe && aspect === "tall") {
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.strokeStyle = "rgba(0,160,255,0.9)";
      ctx.lineWidth = 4;
      ctx.setLineDash([18, 12]);
      ctx.strokeRect(120, 120, 840, 1540);
    }
    return c.toDataURL("image/png");
  }
  function previewFrame(u, mode, aspect) {
    let phase = "intro", stage = "landed", elapsed = 0;
    if (u >= 600 && u < 2400) {
      phase = "speech";
      stage = "speech";
      elapsed = (u - 600) / 1800 * TOTAL;
    } else if (u >= 2400 && u < 3e3) {
      phase = "overtime";
      stage = "done";
      elapsed = TOTAL;
    } else if (u >= 3e3) {
      phase = "outro";
      stage = "done";
      elapsed = TOTAL;
    }
    return {
      t: u,
      topic: "bat\u0131k maliyet yan\u0131lg\u0131s\u0131",
      locale: "tr",
      phase,
      stage,
      sessionMode: "off-the-cuff",
      elapsedSec: elapsed,
      totalSec: TOTAL,
      arcStep: speechArcStep(elapsed, TOTAL),
      micLevel: phase === "speech" ? 0.55 + 0.35 * Math.sin(u / 90) : 0,
      mode,
      aspect
    };
  }
  function preview(styleId, aspect, at, outW) {
    const style = COMPOSITE_STYLES.find((x) => x.id === styleId);
    const W = aspect === "wide" ? 1920 : 1080, H = aspect === "wide" ? 1080 : 1920;
    const c = document.createElement("canvas");
    c.width = outW;
    c.height = Math.round(outW * H / W);
    const ctx = c.getContext("2d");
    const k = outW / W;
    for (let u = 0; u <= at; u += 33) {
      const f = previewFrame(u, "both", aspect);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      style.drawBackground(ctx, f);
      const r = style.layout("both", aspect, { w: W, h: H }, {});
      if (r.screenRect) drawScreenPlaceholder(ctx, r.screenRect);
      if (r.cameraRect) drawAvatar(ctx, r.cameraRect);
      style.drawOverlays(ctx, f);
    }
    return c.toDataURL("image/png");
  }
  var BASE = { spinAt: 8e3, topicAt: 1e4, research: false, locale: "tr", stopAt: null };
  var SHOTS = [
    ["1-bos", 6e3, {}],
    ["2-cekiliyor", 9e3, {}],
    ["3-konu", 12500, {}],
    ["4-arastirma", 12500, { research: true }],
    ["5-konusma", SPEECH_AT + 75e3, {}],
    ["6-sure", DONE_AT + 800, {}],
    ["7-kapanis", DONE_AT + 5e3, {}],
    ["8-erken-durdur", 7e3, { stopAt: 5500 }]
  ];
  function perf(styles, res) {
    for (const id of styles) {
      const style = COMPOSITE_STYLES.find((x) => x.id === id);
      for (const aspect of ["wide", "tall"]) {
        const W = aspect === "wide" ? 1920 : 1080, H = aspect === "wide" ? 1080 : 1920;
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const ctx = c.getContext("2d");
        const t0 = performance.now();
        let n = 0;
        for (let t = SPEECH_AT + 6e4; t < SPEECH_AT + 7e4; t += 33, n++) {
          const f = frameAt(t, "both", aspect, BASE);
          style.drawBackground(ctx, f);
          style.layout("both", aspect, { w: W, h: H }, {});
          style.drawOverlays(ctx, f);
        }
        ctx.getImageData(0, 0, 1, 1);
        res[`perf/${id}-${aspect}`] = ((performance.now() - t0) / n).toFixed(2) + " ms/kare";
      }
    }
  }
  async function main() {
    if (new URLSearchParams(location.search).get("perf")) {
      const res2 = {};
      perf(["kagit", "balon", "gece", "izgara"], res2);
      const pre2 = document.createElement("pre");
      pre2.id = "out";
      pre2.textContent = JSON.stringify(res2);
      document.body.appendChild(pre2);
      return;
    }
    const q = new URLSearchParams(location.search);
    const styles = (q.get("stil") ?? "kagit,balon,gece,izgara").split(",");
    const combos = [["both", "wide"], ["both", "tall"], ["camera", "wide"], ["camera", "tall"], ["screen", "wide"], ["screen", "tall"]];
    const res = {};
    for (const id of styles) {
      const ok = await ensureStyleFonts(COMPOSITE_STYLES.find((x) => x.id === id));
      res[`${id}/fonts`] = String(ok);
      for (const [mode, aspect] of combos) {
        const shots = q.get("all") ? SHOTS : SHOTS.filter(([n]) => ["1-bos", "5-konusma", "7-kapanis"].includes(n) || mode === "both");
        for (const [name, at, over] of shots) {
          res[`${id}/${mode}-${aspect}-${name}`] = render(id, mode, aspect, at, { ...BASE, ...over }, aspect === "wide" ? 960 : 540, aspect === "tall" && name === "5-konusma");
        }
      }
      if (q.get("en")) res[`${id}/en-both-wide-5-konusma`] = render(id, "both", "wide", SPEECH_AT + 75e3, { ...BASE, locale: "en" }, 960);
    }
    if (q.get("onizleme")) {
      for (const id of styles) {
        for (const [aspect, cssW] of [["wide", 260], ["tall", 110]]) {
          for (const u of [300, 1500, 2700, 3900]) res[`onizleme/${id}-${aspect}-${u}`] = preview(id, aspect, u, cssW * 2);
        }
      }
    }
    const pre = document.createElement("pre");
    pre.id = "out";
    pre.textContent = JSON.stringify(res);
    document.body.appendChild(pre);
    document.documentElement.dataset.ready = "1";
  }
  main();
})();
