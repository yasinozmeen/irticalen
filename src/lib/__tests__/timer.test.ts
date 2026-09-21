import { describe, expect, it, vi } from 'vitest';
import { createCountdown, formatClock, speechArcStep } from '../timer';

/** Testte gerçek zamanlayıcı yerine manuel tetiklenen sahte interval. */
function fakeClock(startMs: number) {
  let current = startMs;
  const now = () => current;
  let handler: (() => void) | null = null;
  const setIntervalFn = (fn: () => void) => {
    handler = fn;
    return 1 as unknown as ReturnType<typeof setInterval>;
  };
  const clearIntervalFn = vi.fn();
  const advance = (ms: number) => {
    current += ms;
    handler?.();
  };
  return { now, setIntervalFn, clearIntervalFn, advance };
}

describe('createCountdown', () => {
  it('ilk tick hemen gelir', () => {
    const clock = fakeClock(0);
    const onTick = vi.fn();
    const onDone = vi.fn();
    createCountdown({
      seconds: 5,
      onTick,
      onDone,
      now: clock.now,
      setIntervalFn: clock.setIntervalFn,
      clearIntervalFn: clock.clearIntervalFn,
    });
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenCalledWith(5);
  });

  it('saniye değişmeden tekrar tick çağrılmaz', () => {
    const clock = fakeClock(0);
    const onTick = vi.fn();
    createCountdown({
      seconds: 5,
      onTick,
      onDone: vi.fn(),
      now: clock.now,
      setIntervalFn: clock.setIntervalFn,
      clearIntervalFn: clock.clearIntervalFn,
    });
    expect(onTick).toHaveBeenCalledTimes(1);
    clock.advance(500); // hâlâ aynı saniye içinde (ceil(4500/1000) = 5)
    expect(onTick).toHaveBeenCalledTimes(1);
    clock.advance(500); // toplam 1000 ms geçti -> saniye değişti (5 -> 4)
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(onTick).toHaveBeenLastCalledWith(4);
  });

  it('saat ileri sıçrarsa (sekme uyuması) kalan süre doğru ve onDone tam bir kez çağrılır', () => {
    const clock = fakeClock(0);
    const onTick = vi.fn();
    const onDone = vi.fn();
    createCountdown({
      seconds: 5,
      onTick,
      onDone,
      now: clock.now,
      setIntervalFn: clock.setIntervalFn,
      clearIntervalFn: clock.clearIntervalFn,
    });
    clock.advance(30000); // 30 sn ileri sıçra
    expect(onTick).toHaveBeenLastCalledWith(0);
    expect(onDone).toHaveBeenCalledTimes(1);
    // ekstra tetiklemeler onDone'u tekrar çağırmamalı
    clock.advance(100);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stop() sonrası hiçbir callback gelmez', () => {
    const clock = fakeClock(0);
    const onTick = vi.fn();
    const onDone = vi.fn();
    const countdown = createCountdown({
      seconds: 5,
      onTick,
      onDone,
      now: clock.now,
      setIntervalFn: clock.setIntervalFn,
      clearIntervalFn: clock.clearIntervalFn,
    });
    const callsBefore = onTick.mock.calls.length;
    countdown.stop();
    clock.advance(1000);
    clock.advance(5000);
    expect(onTick).toHaveBeenCalledTimes(callsBefore);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('0 saniye ile başlarsa onDone hemen tetiklenir', () => {
    const clock = fakeClock(0);
    const onDone = vi.fn();
    createCountdown({
      seconds: 0,
      onTick: vi.fn(),
      onDone,
      now: clock.now,
      setIntervalFn: clock.setIntervalFn,
      clearIntervalFn: clock.clearIntervalFn,
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('formatClock', () => {
  it('sınır değerleri doğru biçimlendirir', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(59)).toBe('00:59');
    expect(formatClock(60)).toBe('01:00');
    expect(formatClock(600)).toBe('10:00');
    expect(formatClock(3599)).toBe('59:59');
  });
});

describe('speechArcStep', () => {
  it('süreyi üçe böler: Ne? / Ne olmuş yani? / Şimdi ne?', () => {
    const total = 60;
    expect(speechArcStep(0, total)).toBe(0);
    expect(speechArcStep(19, total)).toBe(0);
    expect(speechArcStep(20, total)).toBe(1);
    expect(speechArcStep(39, total)).toBe(1);
    expect(speechArcStep(40, total)).toBe(2);
    expect(speechArcStep(60, total)).toBe(2);
  });
});
