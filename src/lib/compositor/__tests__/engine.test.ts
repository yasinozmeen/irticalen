import { describe, expect, it, vi } from 'vitest';
import { CompositorEngine, type EngineRecorder } from '../engine';
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
    play: () => Promise.resolve(),
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
  callbacks: { onFailed: ReturnType<typeof vi.fn>; onFinished: ReturnType<typeof vi.fn>; onFpsDrop: ReturnType<typeof vi.fn> };
}

function buildHarness(overrides: { isTypeSupported?: boolean; hasContext?: boolean } = {}): Harness {
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
  const callbacks = { onFailed: vi.fn(), onFinished: vi.fn(), onFpsDrop: vi.fn() };

  const engine = new CompositorEngine(
    {
      createVideo: () => {
        callOrder.push('createVideo');
        return fakeVideo();
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
      topic: 'test',
      locale: 'tr',
      totalSec: 60,
      cameraStream: fakeStream(true),
      audioStream: fakeStream(true),
      getElapsedSec: () => 0,
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
      topic: 't',
      locale: 'tr',
      totalSec: 60,
      cameraStream: fakeStream(),
      getElapsedSec: () => 0,
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
      topic: 't',
      locale: 'tr',
      totalSec: 60,
      cameraStream: fakeStream(),
      getElapsedSec: () => 0,
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
      topic: 't',
      locale: 'tr' as const,
      totalSec: 60,
      cameraStream: fakeStream(),
      getElapsedSec: () => 0,
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
    await h.engine.start({
      mode: 'camera',
      aspect: 'wide',
      style,
      topic: 'konu',
      locale: 'tr',
      totalSec: 60,
      cameraStream: fakeStream(),
      getElapsedSec: () => 0,
    });
    h.worker.emitTick();
    expect(calls).toEqual(['drawBackground', 'drawOverlays:intro']);
    expect(h.ctx.drawImage).toHaveBeenCalledTimes(1);
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
      topic: 't',
      locale: 'tr',
      totalSec: 60,
      cameraStream,
      getElapsedSec: () => 0,
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
      topic: 't',
      locale: 'tr',
      totalSec: 60,
      cameraStream: fakeStream(),
      getElapsedSec: () => 0,
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
      topic: 't',
      locale: 'tr',
      totalSec: 60,
      cameraStream: fakeStream(),
      getElapsedSec: () => 0,
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
      topic: 't',
      locale: 'tr',
      totalSec: 60,
      cameraStream: fakeStream(),
      getElapsedSec: () => 0,
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
      topic: 't',
      locale: 'tr',
      totalSec: 60,
      cameraStream: fakeStream(),
      getElapsedSec: () => 0,
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
