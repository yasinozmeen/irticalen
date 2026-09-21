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
