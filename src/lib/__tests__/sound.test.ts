import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSoundEngine } from '../sound';

function makeFakeAudioContext() {
  const oscillator = {
    type: 'sine',
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gainNode = {
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  const bufferSource = {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const biquad = {
    type: 'bandpass',
    frequency: { value: 0 },
    Q: { value: 0 },
    connect: vi.fn(),
  };
  const createOscillator = vi.fn(() => oscillator);
  const createBufferSource = vi.fn(() => bufferSource);

  class FakeAudioContext {
    currentTime = 0;
    sampleRate = 44100;
    destination = {};
    createOscillator = createOscillator;
    createBufferSource = createBufferSource;
    createGain = vi.fn(() => gainNode);
    createBiquadFilter = vi.fn(() => biquad);
    createBuffer = vi.fn((_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }));
  }

  return { FakeAudioContext, createOscillator, createBufferSource };
}

describe('createSoundEngine', () => {
  const originalAudioContext = (globalThis as Record<string, unknown>).AudioContext;

  afterEach(() => {
    (globalThis as Record<string, unknown>).AudioContext = originalAudioContext;
  });

  it('AudioContext tanımsızken hiçbir fonksiyon fırlatmaz', () => {
    delete (globalThis as Record<string, unknown>).AudioContext;
    delete (globalThis as Record<string, unknown>).webkitAudioContext;
    const engine = createSoundEngine();
    expect(() => engine.warmUp()).not.toThrow();
    expect(() => engine.tick(1)).not.toThrow();
    expect(() => engine.land()).not.toThrow();
    expect(() => engine.fanfare()).not.toThrow();
    expect(() => engine.setMuted(true)).not.toThrow();
    expect(engine.isMuted()).toBe(true); // setMuted(true) az önce çağrıldı
  });

  it('muted iken createOscillator/createBufferSource hiç çağrılmaz', () => {
    const { FakeAudioContext, createOscillator, createBufferSource } = makeFakeAudioContext();
    (globalThis as Record<string, unknown>).AudioContext = FakeAudioContext;

    const engine = createSoundEngine();
    engine.setMuted(true);
    engine.warmUp();
    engine.tick(0.5);
    engine.land();
    engine.fanfare();

    expect(createOscillator).not.toHaveBeenCalled();
    expect(createBufferSource).not.toHaveBeenCalled();
  });

  it('rate-limits ticks so a fast spin cannot stack bursts into distortion', () => {
    const { FakeAudioContext, createBufferSource } = makeFakeAudioContext();
    (globalThis as Record<string, unknown>).AudioContext = FakeAudioContext;
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);

    const engine = createSoundEngine();
    for (let i = 0; i < 20; i++) engine.tick(1);
    expect(createBufferSource).toHaveBeenCalledTimes(1);

    vi.setSystemTime(1_000_000 + 50);
    engine.tick(1);
    expect(createBufferSource).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('mute kapalıyken createOscillator/createBufferSource çağrılır', () => {
    const { FakeAudioContext, createOscillator, createBufferSource } = makeFakeAudioContext();
    (globalThis as Record<string, unknown>).AudioContext = FakeAudioContext;

    const engine = createSoundEngine();
    engine.setMuted(false);
    engine.tick(0.8);
    expect(createBufferSource).toHaveBeenCalledTimes(1);

    engine.land();
    expect(createOscillator).toHaveBeenCalledTimes(3); // C5,E5,G5

    engine.fanfare();
    expect(createOscillator).toHaveBeenCalledTimes(3 + 5); // + G4,C5,E5,G5,C6
  });

  it('isMuted setMuted ile senkron çalışır', () => {
    const engine = createSoundEngine();
    expect(engine.isMuted()).toBe(false);
    engine.setMuted(true);
    expect(engine.isMuted()).toBe(true);
    engine.setMuted(false);
    expect(engine.isMuted()).toBe(false);
  });
});

describe('mixForRecording (kayda efekt sesleri)', () => {
  const originalAudioContext = (globalThis as Record<string, unknown>).AudioContext;
  afterEach(() => {
    (globalThis as Record<string, unknown>).AudioContext = originalAudioContext;
  });

  function install(state: 'running' | 'suspended') {
    const mixTrack = { stop: vi.fn() };
    const dest = { stream: { id: 'karisim', getTracks: () => [mixTrack] } };
    const master = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    const sources: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
    const listeners: string[] = [];
    class Ctx {
      state = state;
      destination = {};
      createGain = vi.fn(() => master);
      createMediaStreamDestination = vi.fn(() => dest);
      createMediaStreamSource = vi.fn(() => {
        const source = { connect: vi.fn(), disconnect: vi.fn() };
        sources.push(source);
        return source;
      });
      resume = vi.fn(() => Promise.resolve());
      addEventListener = vi.fn((type: string) => listeners.push(type));
      removeEventListener = vi.fn();
    }
    (globalThis as Record<string, unknown>).AudioContext = Ctx;
    return { dest, master, sources, listeners, mixTrack };
  }

  const stream = (audio: number) => ({ getAudioTracks: () => Array.from({ length: audio }, () => ({})) }) as unknown as MediaStream;

  it('ses bağlamı çalışmıyorsa null döner (kayıt mikrofonu doğrudan alır, sessiz kalmaz)', () => {
    install('suspended');
    const engine = createSoundEngine();
    expect(engine.mixForRecording([stream(1)])).toBeNull();
  });

  it('çalışırken mikrofonu ve efektleri tek akışta birleştirir; bırakınca bağlantıları söker', () => {
    const { dest, master, sources, mixTrack } = install('running');
    const engine = createSoundEngine();
    const mix = engine.mixForRecording([stream(1), stream(0)]);
    expect(mix?.stream).toBe(dest.stream);
    expect(sources).toHaveLength(1);
    expect(sources[0].connect).toHaveBeenCalledWith(dest);
    expect(master.connect).toHaveBeenCalledWith(dest);
    mix?.release();
    mix?.release();
    expect(sources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(master.disconnect).toHaveBeenCalledWith(dest);
    // The mix's own track ends too — nothing of the take stays live after release.
    expect(mixTrack.stop).toHaveBeenCalledTimes(1);
  });
});
