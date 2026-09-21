/** Geri sayımı durdurma tanıtıcısı. */
export interface Countdown {
  stop(): void;
}

export interface CreateCountdownOptions {
  /** Toplam süre (saniye). */
  seconds: number;
  /** Kalan saniye değişince çağrılır (ilk değer hemen gelir). */
  onTick(remainingSec: number): void;
  /** Süre bitince tam bir kez çağrılır. */
  onDone(): void;
  /** Enjekte edilebilir saat (test için). */
  now?: () => number;
  /** Enjekte edilebilir setInterval (test için). */
  setIntervalFn?: (handler: () => void, ms: number) => ReturnType<typeof setInterval>;
  /** Enjekte edilebilir clearInterval (test için). */
  clearIntervalFn?: (id: ReturnType<typeof setInterval>) => void;
}

/**
 * Duvar saatine göre geri sayım. 100 ms'de bir kontrol eder; kalan saniye
 * yalnızca değiştiğinde onTick çağrılır (ilk değer hemen gelir). 0'a
 * ulaşınca onDone tam bir kez çağrılır ve interval temizlenir. stop()
 * çağrıldıktan sonra hiçbir callback tetiklenmez.
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
  // İlk değeri hemen ver.
  tick();

  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      clearIntervalFn(intervalId);
    },
  };
}

/** Saniyeyi "MM:SS" formatına çevirir. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Konuşma süresi üçe bölünür: 0 = Ne?, 1 = Ne olmuş yani?, 2 = Şimdi ne? */
export function speechArcStep(elapsedSec: number, totalSec: number): 0 | 1 | 2 {
  if (totalSec <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, elapsedSec / totalSec));
  if (ratio < 1 / 3) return 0;
  if (ratio < 2 / 3) return 1;
  return 2;
}
