/** Handle for stopping the countdown. */
export interface Countdown {
  stop(): void;
}

export interface CreateCountdownOptions {
  /** Total duration (seconds). */
  seconds: number;
  /** Called whenever the remaining seconds change (the first value fires immediately). */
  onTick(remainingSec: number): void;
  /** Called exactly once when time runs out. */
  onDone(): void;
  /** Injectable clock (for testing). */
  now?: () => number;
  /** Injectable setInterval (for testing). */
  setIntervalFn?: (handler: () => void, ms: number) => ReturnType<typeof setInterval>;
  /** Injectable clearInterval (for testing). */
  clearIntervalFn?: (id: ReturnType<typeof setInterval>) => void;
}

/**
 * Wall-clock countdown. Checks every 100 ms; onTick fires only when the
 * remaining seconds actually change (the first value fires immediately).
 * When it reaches 0, onDone fires exactly once and the interval is cleared.
 * After stop() is called, no callback fires again.
 */
export function createCountdown(options: CreateCountdownOptions): Countdown {
  const {
    seconds,
    onTick,
    onDone,
    now = Date.now,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  } = options;

  const target = now() + seconds * 1000;
  let lastRemaining: number | null = null;
  let done = false;
  let stopped = false;

  const computeRemaining = (): number => Math.max(0, Math.ceil((target - now()) / 1000));

  const tick = (): void => {
    if (stopped || done) return;
    const remaining = computeRemaining();
    if (remaining !== lastRemaining) {
      lastRemaining = remaining;
      onTick(remaining);
    }
    if (remaining <= 0 && !done) {
      done = true;
      onDone();
      clearIntervalFn(intervalId);
    }
  };

  const intervalId = setIntervalFn(tick, 100);
  // Emit the first value immediately.
  tick();

  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      clearIntervalFn(intervalId);
    },
  };
}

/** Formats seconds as "MM:SS". */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** The speech duration is split into thirds: 0 = What?, 1 = So what?, 2 = Now what? */
export function speechArcStep(elapsedSec: number, totalSec: number): 0 | 1 | 2 {
  if (totalSec <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, elapsedSec / totalSec));
  if (ratio < 1 / 3) return 0;
  if (ratio < 2 / 3) return 1;
  return 2;
}
