import type { Locale } from '../types';
import { VIDEO_MIME_CANDIDATES, pickSupportedMimeType, stopMediaStream } from '../recorder';
import { computeFramePhase, outroFinished, scaleMicRms, smoothMicLevel } from './frame';
import { coverCrop, outputSizeForAspect } from './layout';
import { ensureStyleFonts } from './fonts';
import type { CompositeMode, Frame, FrameStage, Rect, RecordAspect, StyleDefinition } from './types';

/**
 * The composite ('template' format) recording engine: draws camera/screen video onto a canvas every
 * tick (styled by a `StyleDefinition`), captures that canvas as a stream, and records it (with audio)
 * to a single file. Deliberately not a Preact hook — a plain, dependency-injected class so its
 * start/stop/cleanup ordering and fps-degradation logic can be unit-tested with fakes (see
 * `__tests__/engine.test.ts`); `useSelfRecording` (browser-only, untested) just drives an instance of
 * it. See `types.ts`'s `StyleDefinition` doc for the drawing contract itself.
 *
 * Ticking deliberately does not use `requestAnimationFrame`: rAF is throttled/paused when the tab is
 * backgrounded (exactly when someone is screen-sharing another window), which would stall or corrupt
 * the recording. A dedicated Worker's `setInterval` keeps ticking regardless — the worker only ever
 * sends a bare "tick" message; all drawing happens back on the main thread (`onTick` below), since a
 * canvas that isn't transferred to the worker can only be drawn to from the thread that owns it.
 */

const TARGET_FPS = 30;
const DEGRADED_FPS = 24;
/** A tick budget of one frame at the target fps; drawing slower than this repeatedly is what
 * triggers the fps degrade (see `adaptFps`). */
const SLOW_FRAME_BUDGET_MS = 1000 / TARGET_FPS;
/** How many consecutive over-budget frames before degrading — long enough that one GC pause or tab
 * hiccup doesn't trigger it, short enough that a genuinely struggling device recovers quickly. */
const SLOW_FRAME_STREAK = 10;

export type EngineStatus = 'idle' | 'active' | 'outro' | 'failed';

export interface EngineVideoElement {
  srcObject: MediaStream | null;
  muted: boolean;
  playsInline: boolean;
  readonly videoWidth: number;
  readonly videoHeight: number;
  readonly readyState: number;
  /** Absent in tests' fakes; a real element reports whether the browser has paused it. */
  readonly paused?: boolean;
  play(): Promise<void> | void;
  /** Detaches the element from the page (see `createHiddenVideo`). */
  remove?(): void;
}

export interface EngineCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasRenderingContext2D | null;
  captureStream(frameRate?: number): MediaStream;
}

export interface EngineWorker {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export interface EngineRecorder {
  state: string;
  start(): void;
  stop(): void;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
}

/** A live mic-level reader backing `Frame.micLevel` — see `onTick`'s use of `scaleMicRms`/
 * `smoothMicLevel`. Wraps a real `AnalyserNode` in production; injectable/fakeable in tests. */
export interface EngineAudioAnalyser {
  /** Instantaneous RMS (root-mean-square) of the current audio buffer — unbounded above, 0 for
   * silence. Called once per tick; `scaleMicRms` does the 0..1 scaling. */
  read(): number;
  /** Tears down the underlying `AudioContext`/`AnalyserNode`. Idempotent, never throws. */
  close(): void;
}

export interface CompositorEngineDeps {
  createVideo: () => EngineVideoElement;
  createCanvas: (width: number, height: number) => EngineCanvas;
  createWorker: () => EngineWorker;
  createRecorder: (stream: MediaStream, mimeType: string) => EngineRecorder;
  /** Combines the canvas's own video track(s) with the chosen audio track(s) into the stream the
   * recorder actually records — injectable because `MediaStream` itself doesn't exist in the jsdom
   * test environment the rest of this class is otherwise exercised in. */
  createMediaStream: (tracks: MediaStreamTrack[]) => MediaStream;
  isTypeSupported: (type: string) => boolean;
  /** Resolves once (or best-effort — never rejects) the style's drawing fonts are ready, awaited
   * before the first frame is drawn so the opening/intro card never shows a fallback font. */
  loadFont: (style: StyleDefinition) => Promise<void>;
  now: () => number;
  /** Builds the `Frame.micLevel` source from the recorded audio stream, or `null` when no analyser
   * could be created (e.g. no Web Audio support) — `micLevel` then simply stays 0 (see `onTick`). */
  createAudioAnalyser: (stream: MediaStream) => EngineAudioAnalyser | null;
}

/** Live read, once per tick, of everything about the *app's* session a `Frame` needs but the engine
 * has no state of its own for (see `types.ts`'s `Frame` doc) — `topic` may be `null` (a recording can
 * start before a topic has landed) and can change mid-recording if the speaker spins again; `stage`
 * feeds `computeFramePhase`'s pre/speech/overtime split alongside the recording's own intro/outro. */
export interface CompositorAppState {
  stage: FrameStage;
  topic: Frame['topic'];
  sessionMode: Frame['sessionMode'];
  elapsedSec: Frame['elapsedSec'];
  totalSec: Frame['totalSec'];
  arcStep: Frame['arcStep'];
}

export interface CompositorStartParams {
  mode: CompositeMode;
  aspect: RecordAspect;
  style: StyleDefinition;
  locale: Locale;
  cameraStream?: MediaStream;
  screenStream?: MediaStream;
  /** The audio to record: the camera stream's own mic track for 'camera'/'both', or a separately
   * acquired mic-only stream for 'screen' (which has no audio of its own). Omit for no audio track —
   * `micLevel` then stays 0 every tick. */
  audioStream?: MediaStream;
  /** Read live every tick — state updates lag a render, same pattern as the rest of the app. */
  getAppState: () => CompositorAppState;
}

export interface CompositorCallbacks {
  onFailed?: () => void;
  onFinished?: (file: { blob: Blob; mimeType: string }) => void;
  /** Fired once, the moment the engine silently degrades to `DEGRADED_FPS` under load. */
  onFpsDrop?: () => void;
}

function defaultCompositorDeps(): CompositorEngineDeps {
  return {
    createVideo: () => createHiddenVideo(),
    createCanvas: (width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas as unknown as EngineCanvas;
    },
    createWorker: () => new Worker(new URL('./tickWorker.ts', import.meta.url), { type: 'module' }) as unknown as EngineWorker,
    createRecorder: (stream, mimeType) => new MediaRecorder(stream, { mimeType }) as unknown as EngineRecorder,
    createMediaStream: (tracks) => new MediaStream(tracks),
    isTypeSupported: (type) => {
      try {
        return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type);
      } catch {
        return false;
      }
    },
    loadFont: async (style) => {
      try {
        const fontDocument = document as Document & { fonts?: { load(font: string): Promise<unknown> } };
        // Newsreader is the site's own font (already on the page); a style's extra families come from
        // Google Fonts. Usually already fetched by the settings preview — the short timeout only
        // matters on a slow network, where a recording starting with a fallback font beats one that
        // starts seconds late.
        await Promise.all([
          fontDocument.fonts ? fontDocument.fonts.load('600 64px Newsreader') : Promise.resolve(),
          ensureStyleFonts(style, { timeoutMs: 2500 }),
        ]);
      } catch {
        // best-effort — drawing proceeds with fallback font metrics
      }
    },
    now: () => Date.now(),
    createAudioAnalyser: (stream) => {
      try {
        if (stream.getAudioTracks().length === 0) return null;
        const AudioContextCtor = (
          window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
        ).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return null;
        const audioContext = new AudioContextCtor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const buffer = new Float32Array(analyser.fftSize);
        let closed = false;
        return {
          read: () => {
            if (closed) return 0;
            analyser.getFloatTimeDomainData(buffer);
            let sumSquares = 0;
            for (let i = 0; i < buffer.length; i++) sumSquares += buffer[i] * buffer[i];
            return Math.sqrt(sumSquares / buffer.length);
          },
          close: () => {
            if (closed) return;
            closed = true;
            try {
              source.disconnect();
            } catch {
              // best-effort
            }
            try {
              analyser.disconnect();
            } catch {
              // best-effort
            }
            try {
              void audioContext.close();
            } catch {
              // best-effort
            }
          },
        };
      } catch {
        return null;
      }
    },
  };
}

/**
 * The element the engine reads a stream's frames from. It is attached to the page (invisible, 2px,
 * behind everything) rather than left detached: mobile browsers — iOS Safari above all — pause a
 * detached <video> after a while, and the recording then freezes on its last frame while the sound
 * goes on.
 */
function createHiddenVideo(): EngineVideoElement {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.setAttribute('aria-hidden', 'true');
  video.tabIndex = -1;
  video.style.cssText =
    'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(video);
  return video as unknown as EngineVideoElement;
}

/** How often a paused source <video> is told to play again (see `onTick`). */
const VIDEO_WATCHDOG_MS = 1000;

function isVideoReady(video: EngineVideoElement): boolean {
  return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
}

function safePlay(video: EngineVideoElement): void {
  try {
    const result = video.play();
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch(() => {
        // autoplay refusal is harmless here — the element is muted and never shown to the visitor
      });
    }
  } catch {
    // best-effort
  }
}

function drawVideoIntoRect(ctx: CanvasRenderingContext2D, video: EngineVideoElement, rect: Rect): void {
  const crop = coverCrop({ w: video.videoWidth, h: video.videoHeight }, { w: rect.w, h: rect.h });
  if (crop.sw <= 0 || crop.sh <= 0) return;
  ctx.drawImage(
    video as unknown as CanvasImageSource,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
  );
}

export class CompositorEngine {
  private readonly deps: CompositorEngineDeps;
  private readonly callbacks: CompositorCallbacks;
  private status: EngineStatus = 'idle';

  private cameraVideo: EngineVideoElement | null = null;
  private screenVideo: EngineVideoElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private worker: EngineWorker | null = null;
  private recorder: EngineRecorder | null = null;
  private canvasStream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private mimeType = '';
  private micAnalyser: EngineAudioAnalyser | null = null;
  private micLevel = 0;

  private params: CompositorStartParams | null = null;
  private startedAtMs = 0;
  private outroStartedMs: number | null = null;
  private slowStreak = 0;
  private lastWatchdogMs = 0;
  private degraded = false;

  constructor(deps: Partial<CompositorEngineDeps> = {}, callbacks: CompositorCallbacks = {}) {
    this.deps = { ...defaultCompositorDeps(), ...deps };
    this.callbacks = callbacks;
  }

  getStatus(): EngineStatus {
    return this.status;
  }

  /** Starts drawing/recording. Resolves `false` (and fires `onFailed`) without leaving anything
   * running when no source is usable — e.g. no supported MIME type, no 2d context available. Safe to
   * call again after a previous session ended (`idle`/`failed`); refused while one is in progress. */
  async start(params: CompositorStartParams): Promise<boolean> {
    if (this.status === 'active' || this.status === 'outro') return false;
    this.params = params;
    try {
      const mimeType = pickSupportedMimeType(VIDEO_MIME_CANDIDATES, this.deps.isTypeSupported);
      if (!mimeType) throw new Error('no-supported-mime-type');
      this.mimeType = mimeType;

      await this.deps.loadFont(params.style);

      const output = outputSizeForAspect(params.aspect);
      const canvas = this.deps.createCanvas(output.w, output.h);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no-2d-context');
      this.ctx = ctx;

      if (params.cameraStream) {
        const video = this.deps.createVideo();
        video.muted = true;
        video.playsInline = true;
        video.srcObject = params.cameraStream;
        safePlay(video);
        this.cameraVideo = video;
      }
      if (params.screenStream) {
        const video = this.deps.createVideo();
        video.muted = true;
        video.playsInline = true;
        video.srcObject = params.screenStream;
        safePlay(video);
        this.screenVideo = video;
      }

      const canvasStream = canvas.captureStream(TARGET_FPS);
      this.canvasStream = canvasStream;
      const audioTracks = params.audioStream ? params.audioStream.getAudioTracks() : [];
      const outputStream = this.deps.createMediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

      this.micLevel = 0;
      this.micAnalyser = params.audioStream ? this.deps.createAudioAnalyser(params.audioStream) : null;

      const recorder = this.deps.createRecorder(outputStream, mimeType);
      this.chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) this.chunks.push(event.data);
      };
      this.recorder = recorder;
      recorder.start();

      const worker = this.deps.createWorker();
      worker.onmessage = (event) => {
        const data = event.data as { type?: string } | null | undefined;
        if (data?.type === 'tick') this.onTick();
      };
      this.worker = worker;
      worker.postMessage({ type: 'start', ms: 1000 / TARGET_FPS });

      this.startedAtMs = this.deps.now();
      this.outroStartedMs = null;
      this.slowStreak = 0;
      this.degraded = false;
      this.status = 'active';
      return true;
    } catch {
      this.cleanupResources();
      this.status = 'failed';
      this.callbacks.onFailed?.();
      return false;
    }
  }

  /** `keep=false`: stop immediately and discard everything — used for an early close or the visitor
   * navigating away mid-recording. `keep=true` ("kaydı durdur"): begin the outro grace period; the
   * file is only finalized once it plays out (see `onTick`/`OUTRO_MS`). Calling with `keep=true` again
   * while already in the outro is a no-op (let it finish); calling with `keep=false` during the outro
   * switches to an immediate discard (the visitor changed their mind about keeping it). */
  requestStop(keep: boolean): void {
    if (this.status === 'active') {
      if (!keep) {
        this.discard();
        return;
      }
      this.outroStartedMs = this.deps.now();
      this.status = 'outro';
      return;
    }
    if (this.status === 'outro' && !keep) {
      this.discard();
    }
  }

  /** Immediate teardown with nothing finalized — used for unmount/pagehide, where there is no more
   * opportunity to play out an outro. Idempotent. */
  hardStop(): void {
    if (this.status === 'active' || this.status === 'outro') this.discard();
  }

  private stopWorker(): void {
    if (!this.worker) return;
    try {
      this.worker.postMessage({ type: 'stop' });
    } catch {
      // best-effort
    }
    try {
      this.worker.terminate();
    } catch {
      // best-effort
    }
    this.worker = null;
  }

  private cleanupResources(): void {
    stopMediaStream(this.canvasStream);
    this.canvasStream = null;
    if (this.params) {
      stopMediaStream(this.params.cameraStream ?? null);
      stopMediaStream(this.params.screenStream ?? null);
      if (this.params.audioStream && this.params.audioStream !== this.params.cameraStream) {
        stopMediaStream(this.params.audioStream);
      }
    }
    if (this.cameraVideo) {
      this.cameraVideo.srcObject = null;
      this.cameraVideo.remove?.();
      this.cameraVideo = null;
    }
    if (this.screenVideo) {
      this.screenVideo.srcObject = null;
      this.screenVideo.remove?.();
      this.screenVideo = null;
    }
    if (this.micAnalyser) {
      try {
        this.micAnalyser.close();
      } catch {
        // best-effort
      }
      this.micAnalyser = null;
    }
    this.micLevel = 0;
    this.ctx = null;
    this.params = null;
    this.outroStartedMs = null;
    this.slowStreak = 0;
    this.degraded = false;
  }

  private discard(): void {
    this.stopWorker();
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder) {
      recorder.onstop = null;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // best-effort
      }
    }
    this.chunks = [];
    this.cleanupResources();
    this.status = 'idle';
  }

  private finalizeAndStop(): void {
    this.stopWorker();
    const recorder = this.recorder;
    const mimeType = this.mimeType;
    const finish = (): void => {
      const chunks = this.chunks;
      this.chunks = [];
      this.recorder = null;
      this.cleanupResources();
      if (chunks.length === 0) {
        this.status = 'failed';
        this.callbacks.onFailed?.();
        return;
      }
      try {
        const blob = new Blob(chunks, mimeType ? { type: mimeType } : undefined);
        this.status = 'idle';
        this.callbacks.onFinished?.({ blob, mimeType });
      } catch {
        this.status = 'failed';
        this.callbacks.onFailed?.();
      }
    };
    if (!recorder) {
      finish();
      return;
    }
    recorder.onstop = finish;
    try {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        recorder.onstop();
      }
    } catch {
      this.recorder = null;
      this.chunks = [];
      this.cleanupResources();
      this.status = 'failed';
      this.callbacks.onFailed?.();
    }
  }

  private adaptFps(durationMs: number): void {
    if (this.degraded) return;
    if (durationMs > SLOW_FRAME_BUDGET_MS) {
      this.slowStreak += 1;
      if (this.slowStreak >= SLOW_FRAME_STREAK) {
        this.degraded = true;
        try {
          this.worker?.postMessage({ type: 'interval', ms: 1000 / DEGRADED_FPS });
        } catch {
          // best-effort
        }
        this.callbacks.onFpsDrop?.();
      }
    } else {
      this.slowStreak = 0;
    }
  }

  private onTick(): void {
    if (this.status !== 'active' && this.status !== 'outro') return;
    const { ctx, params } = this;
    if (!ctx || !params) return;

    const drawStart = this.deps.now();
    const recordingElapsedMs = drawStart - this.startedAtMs;
    // A browser may still pause a source <video> (phone screen dimmed, audio session interrupted…):
    // without this the recording would freeze on that frame for the rest of the take.
    if (drawStart - this.lastWatchdogMs >= VIDEO_WATCHDOG_MS) {
      this.lastWatchdogMs = drawStart;
      if (this.cameraVideo?.paused) safePlay(this.cameraVideo);
      if (this.screenVideo?.paused) safePlay(this.screenVideo);
    }
    const outroElapsedMs = this.outroStartedMs !== null ? drawStart - this.outroStartedMs : null;
    const appState = params.getAppState();
    const phase = computeFramePhase({ recordingElapsedMs, stage: appState.stage, outroElapsedMs });

    if (this.micAnalyser) {
      let instant = 0;
      try {
        instant = scaleMicRms(this.micAnalyser.read());
      } catch {
        instant = 0;
      }
      this.micLevel = smoothMicLevel(this.micLevel, instant);
    } else {
      this.micLevel = 0;
    }

    const frame: Frame = {
      t: recordingElapsedMs,
      topic: appState.topic,
      locale: params.locale,
      phase,
      stage: appState.stage,
      sessionMode: appState.sessionMode,
      elapsedSec: appState.elapsedSec,
      totalSec: appState.totalSec,
      arcStep: appState.arcStep,
      micLevel: this.micLevel,
      mode: params.mode,
      aspect: params.aspect,
    };

    const output = outputSizeForAspect(params.aspect);
    const style = params.style;
    style.drawBackground(ctx, frame);

    const sources: { camera?: { w: number; h: number }; screen?: { w: number; h: number } } = {};
    if (this.cameraVideo && isVideoReady(this.cameraVideo)) {
      sources.camera = { w: this.cameraVideo.videoWidth, h: this.cameraVideo.videoHeight };
    }
    if (this.screenVideo && isVideoReady(this.screenVideo)) {
      sources.screen = { w: this.screenVideo.videoWidth, h: this.screenVideo.videoHeight };
    }
    const result = style.layout(params.mode, params.aspect, output, sources);
    if (result.cameraRect && this.cameraVideo && sources.camera) drawVideoIntoRect(ctx, this.cameraVideo, result.cameraRect);
    if (result.screenRect && this.screenVideo && sources.screen) drawVideoIntoRect(ctx, this.screenVideo, result.screenRect);

    style.drawOverlays(ctx, frame);

    this.adaptFps(this.deps.now() - drawStart);

    if (phase === 'outro' && outroElapsedMs !== null && outroFinished(outroElapsedMs)) {
      this.finalizeAndStop();
    }
  }
}
