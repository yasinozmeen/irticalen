import { describe, expect, it } from 'vitest';
import { computeFramePhase, INTRO_MS, OUTRO_MS, outroFinished } from '../frame';

describe('computeFramePhase', () => {
  it('outro her zaman kazanır', () => {
    expect(
      computeFramePhase({ recordingElapsedMs: 500, elapsedSec: 0, totalSec: 60, outroElapsedMs: 100 }),
    ).toBe('outro');
    expect(
      computeFramePhase({ recordingElapsedMs: 500000, elapsedSec: 999, totalSec: 60, outroElapsedMs: 0 }),
    ).toBe('outro');
  });

  it('kaydın ilk INTRO_MS süresi intro', () => {
    expect(
      computeFramePhase({ recordingElapsedMs: 0, elapsedSec: 0, totalSec: 60, outroElapsedMs: null }),
    ).toBe('intro');
    expect(
      computeFramePhase({ recordingElapsedMs: INTRO_MS - 1, elapsedSec: 0, totalSec: 60, outroElapsedMs: null }),
    ).toBe('intro');
  });

  it('intro bitince, süre dolana kadar speech', () => {
    expect(
      computeFramePhase({ recordingElapsedMs: INTRO_MS, elapsedSec: 5, totalSec: 60, outroElapsedMs: null }),
    ).toBe('speech');
    expect(
      computeFramePhase({ recordingElapsedMs: INTRO_MS + 1000, elapsedSec: 59, totalSec: 60, outroElapsedMs: null }),
    ).toBe('speech');
  });

  it('elapsedSec totalSec\'e ulaşınca overtime', () => {
    expect(
      computeFramePhase({ recordingElapsedMs: INTRO_MS + 1000, elapsedSec: 60, totalSec: 60, outroElapsedMs: null }),
    ).toBe('overtime');
    expect(
      computeFramePhase({ recordingElapsedMs: INTRO_MS + 1000, elapsedSec: 90, totalSec: 60, outroElapsedMs: null }),
    ).toBe('overtime');
  });

  it('totalSec <= 0 iken hiçbir zaman overtime raporlanmaz', () => {
    expect(
      computeFramePhase({ recordingElapsedMs: INTRO_MS + 1000, elapsedSec: 0, totalSec: 0, outroElapsedMs: null }),
    ).toBe('speech');
  });
});

describe('outroFinished', () => {
  it('OUTRO_MS altı bitmemiştir, eşit/üstü bitmiştir', () => {
    expect(outroFinished(OUTRO_MS - 1)).toBe(false);
    expect(outroFinished(OUTRO_MS)).toBe(true);
    expect(outroFinished(OUTRO_MS + 500)).toBe(true);
  });
});
