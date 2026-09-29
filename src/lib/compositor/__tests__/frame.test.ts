import { describe, expect, it } from 'vitest';
import { computeFramePhase, INTRO_MS, OUTRO_MS, outroFinished, scaleMicRms, smoothMicLevel } from '../frame';
import type { FrameStage } from '../types';

const STEADY_STAGES: FrameStage[] = ['idle', 'spinning', 'landed', 'research', 'ready'];

describe('computeFramePhase', () => {
  it('outro her zaman kazanır', () => {
    expect(computeFramePhase({ recordingElapsedMs: 500, stage: 'speech', outroElapsedMs: 100 })).toBe('outro');
    expect(computeFramePhase({ recordingElapsedMs: 500000, stage: 'done', outroElapsedMs: 0 })).toBe('outro');
  });

  it('kaydın ilk INTRO_MS süresi intro (stage ne olursa olsun)', () => {
    expect(computeFramePhase({ recordingElapsedMs: 0, stage: 'idle', outroElapsedMs: null })).toBe('intro');
    expect(computeFramePhase({ recordingElapsedMs: INTRO_MS - 1, stage: 'speech', outroElapsedMs: null })).toBe(
      'intro',
    );
  });

  it("intro bitince stage 'speech' ise speech", () => {
    expect(computeFramePhase({ recordingElapsedMs: INTRO_MS, stage: 'speech', outroElapsedMs: null })).toBe('speech');
  });

  it("intro bitince stage 'done' ise overtime", () => {
    expect(computeFramePhase({ recordingElapsedMs: INTRO_MS, stage: 'done', outroElapsedMs: null })).toBe('overtime');
  });

  it("intro bitince diğer her stage (idle/spinning/landed/research/ready) pre", () => {
    for (const stage of STEADY_STAGES) {
      expect(computeFramePhase({ recordingElapsedMs: INTRO_MS + 1000, stage, outroElapsedMs: null })).toBe('pre');
    }
  });
});

describe('outroFinished', () => {
  it('OUTRO_MS altı bitmemiştir, eşit/üstü bitmiştir', () => {
    expect(outroFinished(OUTRO_MS - 1)).toBe(false);
    expect(outroFinished(OUTRO_MS)).toBe(true);
    expect(outroFinished(OUTRO_MS + 500)).toBe(true);
  });
});

describe('scaleMicRms', () => {
  it('0 ve altı sessizliktir', () => {
    expect(scaleMicRms(0)).toBe(0);
    expect(scaleMicRms(-1)).toBe(0);
  });

  it('sonlu olmayan değer sessizliğe düşer', () => {
    expect(scaleMicRms(NaN)).toBe(0);
    expect(scaleMicRms(Infinity)).toBe(0);
  });

  it('ölçeklenmiş değer 0..1 aralığında kırpılır', () => {
    expect(scaleMicRms(0.1)).toBeCloseTo(0.4, 5);
    expect(scaleMicRms(1)).toBe(1);
    expect(scaleMicRms(10)).toBe(1);
  });
});

describe('smoothMicLevel', () => {
  it('yükselirken hızlı (attack), düşerken yavaş (release) hareket eder', () => {
    const attackStep = smoothMicLevel(0, 1) - 0;
    const releaseStep = 1 - smoothMicLevel(1, 0);
    expect(attackStep).toBeGreaterThan(releaseStep);
  });

  it('girdileri 0..1 aralığına kırpar', () => {
    expect(smoothMicLevel(-1, 2)).toBeGreaterThanOrEqual(0);
    expect(smoothMicLevel(-1, 2)).toBeLessThanOrEqual(1);
  });

  it('aynı değerde durağan kalır', () => {
    expect(smoothMicLevel(0.5, 0.5)).toBeCloseTo(0.5, 10);
    expect(smoothMicLevel(0, 0)).toBe(0);
  });
});
