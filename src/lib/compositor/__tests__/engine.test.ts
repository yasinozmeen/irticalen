import { describe, expect, it, vi } from 'vitest';
import { CompositorEngine, type CompositorAppState, type EngineRecorder } from '../engine';
import { OUTRO_MS } from '../frame';
import type { CompositeLayout, CompositeMode, CompositeSources, Frame, RecordAspect, Size, StyleDefinition } from '../types';

function fakeStream(withAudio = false): MediaStream {
  const videoTrack = { stop: vi.fn(), kind: 'video' };
  const audioTrack = { stop: vi.fn(), kind: 'audio' };
  const tracks = withAudio ? [videoTrack, audioTrack] : [videoTrack];
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
  } as unknown as MediaStream;
}

function fakeVideo() {
  return {
    srcObject: null,
    muted: false,
    playsInline: false,
    videoWidth: 1280,
    videoHeight: 720,
    readyState: 2,
    paused: false,
    currentTime: 0 as number | undefined,
    play: vi.fn(() => Promise.resolve()),
    remove: vi.fn(),
  };
}

function fakeWorker() {
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null as ((event: { data: unknown }) => void) | null,
    emitTick() {
      worker.onmessage?.({ data: { type: 'tick' } });
    },
  };
  return worker;
}

function fakeRecorder(): EngineRecorder {
  const recorder: EngineRecorder = {
    state: 'recording',
    start: vi.fn(),
    stop: vi.fn(() => {
      recorder.state = 'inactive';
      recorder.onstop?.();
    }),
    ondataavailable: null,
    onstop: null,
  };
  return recorder;
}

function fakeStyle(calls: string[]): StyleDefinition {
  return {
    id: 'fake',
    labelKey: 'fake',
    aspects: ['wide', 'tall'],
    layout: (mode: CompositeMode, _aspect: RecordAspect, output: Size, _sources: CompositeSources): CompositeLayout => ({
      cameraRect: { x: 0, y: 0, w: output.w, h: output.h },
      screenRect: mode === 'both' ? { x: 0, y: 0, w: output.w, h: output.h } : undefined,
    }),
    drawBackground: () => calls.push('drawBackground'),
    drawOverlays: (_ctx: CanvasRenderingContext2D, frame: Frame) => calls.push(`drawOverlays:${frame.phase}`),
  };
}

/** Default app state for a session already mid-speech — most tests just care about the recording
 * lifecycle, not the app's own state, so this is a sensible steady value to start from. */
function defaultAppState(overrides: Partial<CompositorAppState> = {}): CompositorAppState {
  return {
    stage: 'speech',
    topic: 'konu',
    sessionMode: 'off-the-cuff',
    elapsedSec: 0,
    totalSec: 60,
    arcStep: 0,
    ...overrides,
  };
}

interface Harness {
  engine: CompositorEngine;
  worker: ReturnType<typeof fakeWorker>;
  recorder: EngineRecorder;
  ctx: { drawImage: ReturnType<typeof vi.fn> };
  callOrder: string[];
  /** Sets the clock to an absolute value (subsequent `now()` calls return it as-is, `step` permitting). */
  setNow: (ms: number) => void;
  /** Makes every `now()` call advance the clock by this much *after* reading it — used to simulate a
   * tick whose draw takes a fixed, non-zero duration (two `now()` calls happen per tick: one at the
   * start, one at the end) without needing to hand-drive the clock between them. */
  setStep: (ms: number) => void;
  callbacks: { onFailed: ReturnType<typeof vi.fn>; onFinished: ReturnType<typeof vi.fn>; onFpsDrop: ReturnType<typeof vi.fn>; onCameraStreamReplaced: ReturnType<typeof vi.fn> };
  /** Swaps the app state a subsequent tick reads — defaults to `defaultAppState()`. */
  setAppState: (state: CompositorAppState) => void;
  getAppState: () => CompositorAppState;
  /** The `createAudioAnalyser` fake's last returned reader (if any), so a test can flip its output. */
  micRms: { value: number };
  micAnalyserCreated: ReturnType<typeof vi.fn>;
  videos: ReturnType<typeof fakeVideo>[];
  reacquireCamera: ReturnType<typeof vi.fn>;
}

function buildHarness(overrides: { isTypeSupported?: boolean; hasContext?: boolean; withMicAnalyser?: boolean } = {}): Harness {
  const callOrder: string[] = [];
  let current = 0;
  let step = 0;
  const worker = fakeWorker();
  const recorder = fakeRecorder();
  const ctx = { drawImage: vi.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => {
      callOrder.push('getContext');
      return overrides.hasContext === false ? null : (ctx as unknown as CanvasRenderingContext2D);
    },
    captureStream: () => {
      callOrder.push('captureStream');
      return fakeStream();
    },
  };
  const callbacks = { onFailed: vi.fn(), onFinished: vi.fn(), onFpsDrop: vi.fn(), onCameraStreamReplaced: vi.fn() };
  const reacquireCamera = vi.fn(async () => fakeStream());
  let appState = defaultAppState();
  const micRms = { value: 0 };
  const micAnalyserCreated = vi.fn();
  const videos: ReturnType<typeof fakeVideo>[] = [];

  const engine = new CompositorEngine(
    {
      createVideo: () => {
        callOrder.push('createVideo');
        const video = fakeVideo();
        videos.push(video);
        return video;
      },
      createCanvas: () => {
        callOrder.push('createCanvas');
        return canvas;
      },
      createWorker: () => {
        callOrder.push('createWorker');
        return worker;
      },
      createRecorder: (_stream, _mimeType) => {
        callOrder.push('createRecorder');
        return recorder;
      },
      createMediaStream: (tracks) => {
        callOrder.push('createMediaStream');
        return { getTracks: () => tracks, getVideoTracks: () => tracks, getAudioTracks: () => tracks } as unknown as MediaStream;
      },
      isTypeSupported: () => overrides.isTypeSupported !== false,
      loadFont: async () => {
        callOrder.push('loadFont');
      },
      now: () => {
        const value = current;
        current += step;
        return value;
      },
      createAudioAnalyser: overrides.withMicAnalyser
        ? (_stream) => {
            micAnalyserCreated();
            return { read: () => micRms.value, close: vi.fn() };
          }
        : () => null,
      reacquireCamera,
    },
    callbacks,
  );

  return {
    engine,
    worker,
    recorder,
    ctx,
    callOrder,
    setNow: (ms) => (current = ms),
    setStep: (ms) => (step = ms),
    callbacks,
    setAppState: (state) => (appState = state),
    getAppState: () => appState,
    micRms,
    micAnalyserCreated,
    videos,
    reacquireCamera,
  };
}

describe('CompositorEngine.start', () => {
  it('doğru sırayla kurar: font -> canvas -> video -> worker -> recorder.start', async () => {
    const h = buildHarness();
    const style = fakeStyle([]);
    const ok = await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style,
      locale: 'tr',
      cameraStream: fakeStream(true),
      audioStream: fakeStream(true),
      getAppState: h.getAppState,
    });
    expect(ok).toBe(true);
    expect(h.engine.getStatus()).toBe('active');
    const idx = (name: string) => h.callOrder.indexOf(name);
    expect(idx('loadFont')).toBeGreaterThanOrEqual(0);
    expect(idx('createCanvas')).toBeGreaterThan(idx('loadFont'));
    expect(idx('createVideo')).toBeGreaterThan(idx('createCanvas'));
    expect(idx('captureStream')).toBeGreaterThan(idx('createVideo'));
    expect(idx('createRecorder')).toBeGreaterThan(idx('captureStream'));
    expect(idx('createWorker')).toBeGreaterThan(idx('createRecorder'));
    expect(h.recorder.start).toHaveBeenCalledTimes(1);
    expect(h.worker.postMessage).toHaveBeenCalledWith({ type: 'start', ms: 1000 / 30 });
  });

  it('desteklenen MIME yoksa false döner, hiçbir şey kurmaz, onFailed çağrılır', async () => {
    const h = buildHarness({ isTypeSupported: false });
    const ok = await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style: fakeStyle([]),
      locale: 'tr',
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    });
    expect(ok).toBe(false);
    expect(h.engine.getStatus()).toBe('failed');
    expect(h.callbacks.onFailed).toHaveBeenCalledTimes(1);
    expect(h.callOrder).not.toContain('createCanvas');
  });

  it('2d context alınamazsa false döner, onFailed çağrılır', async () => {
    const h = buildHarness({ hasContext: false });
    const ok = await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style: fakeStyle([]),
      locale: 'tr',
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    });
    expect(ok).toBe(false);
    expect(h.engine.getStatus()).toBe('failed');
    expect(h.callbacks.onFailed).toHaveBeenCalledTimes(1);
  });

  it('zaten aktifken tekrar start çağrılırsa reddedilir', async () => {
    const h = buildHarness();
    const params = {
      mode: 'camera' as const,
      aspect: 'wide' as const,
      style: fakeStyle([]),
      locale: 'tr' as const,
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    };
    await h.engine.start(params);
    const second = await h.engine.start(params);
    expect(second).toBe(false);
    expect(h.callOrder.filter((c) => c === 'createRecorder')).toHaveLength(1);
  });
});

describe('CompositorEngine tick/draw', () => {
  it('her tick style.drawBackground ve drawOverlays çağırır; fazından geçer', async () => {
    const h = buildHarness();
    const calls: string[] = [];
    const style = fakeStyle(calls);
    h.setAppState(defaultAppState({ stage: 'idle' }));
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style,
      locale: 'tr',
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    });
    h.worker.emitTick();
    expect(calls).toEqual(['drawBackground', 'drawOverlays:intro']);
    expect(h.ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it("intro'dan sonra stage 'pre' ise phase pre, 'speech' ise speech, 'done' ise overtime olur", async () => {
    const h = buildHarness();
    const calls: string[] = [];
    const style = fakeStyle(calls);
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style,
      locale: 'tr',
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    });
    h.setNow(4000); // past INTRO_MS

    h.setAppState(defaultAppState({ stage: 'research' }));
    h.worker.emitTick();
    expect(calls.at(-1)).toBe('drawOverlays:pre');

    h.setAppState(defaultAppState({ stage: 'speech' }));
    h.worker.emitTick();
    expect(calls.at(-1)).toBe('drawOverlays:speech');

    h.setAppState(defaultAppState({ stage: 'done' }));
    h.worker.emitTick();
    expect(calls.at(-1)).toBe('drawOverlays:overtime');
  });

  it('appState alanları (topic/stage/sessionMode/elapsed/total/arcStep) frame’e aktarılır', async () => {
    const h = buildHarness();
    let lastFrame: Frame | null = null;
    const style: StyleDefinition = {
      ...fakeStyle([]),
      drawOverlays: (_ctx, frame) => {
        lastFrame = frame;
      },
    };
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style,
      locale: 'tr',
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    });
    h.setNow(4000);
    h.setAppState({ stage: 'speech', topic: 'irticalen', sessionMode: 'deep-research', elapsedSec: 12, totalSec: 60, arcStep: 1 });
    h.worker.emitTick();
    expect(lastFrame).not.toBeNull();
    expect(lastFrame!.topic).toBe('irticalen');
    expect(lastFrame!.stage).toBe('speech');
    expect(lastFrame!.sessionMode).toBe('deep-research');
    expect(lastFrame!.elapsedSec).toBe(12);
    expect(lastFrame!.totalSec).toBe(60);
    expect(lastFrame!.arcStep).toBe(1);
  });

  it('topic null iken frame.topic null’dır (konu henüz gelmemiş)', async () => {
    const h = buildHarness();
    let lastFrame: Frame | null = null;
    const style: StyleDefinition = { ...fakeStyle([]), drawOverlays: (_ctx, frame) => { lastFrame = frame; } };
    h.setAppState(defaultAppState({ stage: 'idle', topic: null }));
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style,
      locale: 'tr',
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    });
    h.worker.emitTick();
    expect(lastFrame!.topic).toBeNull();
  });
});

describe('CompositorEngine mic level', () => {
  it('ses izi yoksa micLevel her zaman 0’dır', async () => {
    const h = buildHarness({ withMicAnalyser: false });
    let lastFrame: Frame | null = null;
    const style: StyleDefinition = { ...fakeStyle([]), drawOverlays: (_ctx, frame) => { lastFrame = frame; } };
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style,
      locale: 'tr',
      cameraStream: fakeStream(true),
      audioStream: fakeStream(true),
      getAppState: h.getAppState,
    });
    h.worker.emitTick();
    h.worker.emitTick();
    expect(lastFrame!.micLevel).toBe(0);
  });

  it('ses izi varsa micLevel analizörün okuduğu değere doğru yumuşayarak yaklaşır', async () => {
    const h = buildHarness({ withMicAnalyser: true });
    const frames: Frame[] = [];
    const style: StyleDefinition = { ...fakeStyle([]), drawOverlays: (_ctx, frame) => frames.push(frame) };
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style,
      locale: 'tr',
      cameraStream: fakeStream(true),
      audioStream: fakeStream(true),
      getAppState: h.getAppState,
    });
    expect(h.micAnalyserCreated).toHaveBeenCalledTimes(1);
    h.micRms.value = 0.1; // scaleMicRms(0.1) = 0.4
    h.worker.emitTick();
    h.worker.emitTick();
    expect(frames[0].micLevel).toBeGreaterThan(0);
    expect(frames[1].micLevel).toBeGreaterThan(frames[0].micLevel);
    expect(frames[1].micLevel).toBeLessThanOrEqual(0.4 + 1e-9);
  });

  it('audioStream verilmezse analizör hiç oluşturulmaz', async () => {
    const h = buildHarness({ withMicAnalyser: true });
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style: fakeStyle([]),
      locale: 'tr',
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    });
    expect(h.micAnalyserCreated).not.toHaveBeenCalled();
  });
});

describe('CompositorEngine.requestStop', () => {
  it('keep=false: worker sonlandırılır, recorder.stop çağrılır (onstop tetiklenmez), akışlar durur, status idle olur', async () => {
    const h = buildHarness();
    const cameraStream = fakeStream(true);
    const videoTrack = cameraStream.getVideoTracks()[0] as unknown as { stop: ReturnType<typeof vi.fn> };
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style: fakeStyle([]),
      locale: 'tr',
      cameraStream,
      getAppState: h.getAppState,
    });
    h.engine.requestStop(false);
    expect(h.worker.terminate).toHaveBeenCalledTimes(1);
    expect(h.recorder.stop).toHaveBeenCalledTimes(1);
    expect(h.callbacks.onFinished).not.toHaveBeenCalled();
    expect(videoTrack.stop).toHaveBeenCalledTimes(1);
    expect(h.engine.getStatus()).toBe('idle');
  });

  it('keep=true: hemen bitmez ("outro"), OUTRO_MS sonra sonlanır ve onFinished blob ile çağrılır', async () => {
    const h = buildHarness();
    const calls: string[] = [];
    const style = fakeStyle(calls);
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style,
      locale: 'tr',
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    });
    h.recorder.ondataavailable?.({ data: new Blob(['x'], { type: 'video/webm' }) });

    h.setNow(1000);
    h.engine.requestStop(true);
    expect(h.engine.getStatus()).toBe('outro');
    expect(h.recorder.stop).not.toHaveBeenCalled();

    // Still within the outro window — not finished yet.
    h.setNow(1000 + OUTRO_MS - 1);
    h.worker.emitTick();
    expect(h.recorder.stop).not.toHaveBeenCalled();
    expect(calls.at(-1)).toBe('drawOverlays:outro');

    // Outro window elapsed — the next tick finalizes.
    h.setNow(1000 + OUTRO_MS);
    h.worker.emitTick();
    expect(h.worker.terminate).toHaveBeenCalledTimes(1);
    expect(h.recorder.stop).toHaveBeenCalledTimes(1);
    expect(h.callbacks.onFinished).toHaveBeenCalledTimes(1);
    const file = h.callbacks.onFinished.mock.calls[0][0];
    expect(file.blob).toBeInstanceOf(Blob);
    expect(h.engine.getStatus()).toBe('idle');
  });

  it('veri toplanmadan bitirilirse onFinished değil onFailed çağrılır', async () => {
    const h = buildHarness();
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style: fakeStyle([]),
      locale: 'tr',
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    });
    h.setNow(1000);
    h.engine.requestStop(true);
    h.setNow(1000 + OUTRO_MS);
    h.worker.emitTick();
    expect(h.callbacks.onFinished).not.toHaveBeenCalled();
    expect(h.callbacks.onFailed).toHaveBeenCalledTimes(1);
  });
});

describe('CompositorEngine.hardStop', () => {
  it('idle iken no-op', () => {
    const h = buildHarness();
    expect(() => h.engine.hardStop()).not.toThrow();
    expect(h.worker.terminate).not.toHaveBeenCalled();
  });

  it('aktifken discard ile aynı temizliği yapar', async () => {
    const h = buildHarness();
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style: fakeStyle([]),
      locale: 'tr',
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    });
    h.engine.hardStop();
    expect(h.worker.terminate).toHaveBeenCalledTimes(1);
    expect(h.recorder.stop).toHaveBeenCalledTimes(1);
    expect(h.engine.getStatus()).toBe('idle');
  });
});

describe('CompositorEngine fps degrade', () => {
  it('çizim süresi art arda bütçeyi aşarsa worker aralığı 24fps\'e düşürülür ve onFpsDrop bir kez tetiklenir', async () => {
    const h = buildHarness();
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style: fakeStyle([]),
      locale: 'tr',
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    });
    h.worker.postMessage.mockClear();
    // Every `now()` call advances the clock by 40ms — since each tick reads it once at the start and
    // once at the end, that simulates a draw that always takes 40ms (> the ~33.3ms budget).
    h.setStep(40);
    // 10 in a row should trigger the degrade — the 9th must not have yet.
    for (let i = 0; i < 9; i++) h.worker.emitTick();
    expect(h.callbacks.onFpsDrop).not.toHaveBeenCalled();
    h.worker.emitTick();
    expect(h.callbacks.onFpsDrop).toHaveBeenCalledTimes(1);
    expect(h.worker.postMessage).toHaveBeenCalledWith({ type: 'interval', ms: 1000 / 24 });
  });
});

describe('CompositorEngine video watchdog', () => {
  it('tarayıcı kaynak videoyu duraklatırsa en geç bir saniyede yeniden oynatılır (kayıt donmaz)', async () => {
    const h = buildHarness();
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style: fakeStyle([]),
      locale: 'tr',
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    });
    const video = h.videos[0];
    const playsAtStart = video.play.mock.calls.length;
    video.paused = true;
    h.setNow(400);
    h.worker.emitTick();
    video.currentTime = 1;
    h.setNow(1500);
    h.worker.emitTick();
    expect(video.play.mock.calls.length).toBe(playsAtStart + 1);
    video.paused = false;
    video.currentTime = 2;
    h.setNow(3000);
    h.worker.emitTick();
    expect(video.play.mock.calls.length).toBe(playsAtStart + 1);
  });

  it('kayıt bitince kaynak video sayfadan kaldırılır', async () => {
    const h = buildHarness();
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style: fakeStyle([]),
      locale: 'tr',
      cameraStream: fakeStream(),
      getAppState: h.getAppState,
    });
    h.engine.hardStop();
    expect(h.videos[0].remove).toHaveBeenCalledTimes(1);
  });
});

describe('CompositorEngine camera interruption (iOS: app switch, Control Center)', () => {
  const startCamera = async (h: Harness, stream = fakeStream()) => {
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style: fakeStyle([]),
      locale: 'tr',
      cameraStream: stream,
      getAppState: h.getAppState,
    });
    return h.videos[0];
  };

  it('görüntü ilerlemeyi bırakırsa (duraklatılmış görünmese de) akış yeniden bağlanır', async () => {
    const h = buildHarness();
    const stream = fakeStream();
    const video = await startCamera(h, stream);
    video.srcObject = stream as never;
    const plays = video.play.mock.calls.length;
    for (const [ms, time] of [[1000, 1], [2000, 2], [3000, 2], [4000, 2], [5000, 2]] as const) {
      video.currentTime = time;
      h.setNow(ms);
      h.worker.emitTick();
    }
    expect(video.play.mock.calls.length).toBe(plays + 1);
    expect(video.srcObject).toBe(stream);
  });

  it('görüntü akarken hiçbir şeye dokunulmaz', async () => {
    const h = buildHarness();
    const video = await startCamera(h);
    const plays = video.play.mock.calls.length;
    for (let i = 1; i <= 6; i += 1) {
      video.currentTime = i;
      h.setNow(i * 1000);
      h.worker.emitTick();
    }
    expect(video.play.mock.calls.length).toBe(plays);
    expect(h.reacquireCamera).not.toHaveBeenCalled();
  });

  it('kamera izi tamamen biterse kamera yeniden alınır, önizleme haberdar edilir', async () => {
    const h = buildHarness();
    const stream = fakeStream();
    const video = await startCamera(h, stream);
    video.srcObject = stream as never;
    (stream.getVideoTracks()[0] as unknown as { readyState: string }).readyState = 'ended';
    h.setNow(1000);
    h.worker.emitTick();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.reacquireCamera).toHaveBeenCalledTimes(1);
    expect(video.srcObject).not.toBe(stream);
    expect(h.callbacks.onCameraStreamReplaced).toHaveBeenCalledWith(video.srcObject);
  });
});
