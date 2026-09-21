/** Çevirme animasyonu toplam süresi (ms). */
export const SPIN_DURATION_MS = 4800;
/** Çevirme güvenlik zaman aşımı (ms) — animasyon bu süreye kadar kesin biter. */
export const SPIN_SAFETY_MS = 5100;

/** Bir çevirmenin planı: kaç adım atılacağı ve nereye ineceği. */
export interface SpinPlan {
  totalSteps: number;
  landIndex: number;
}

/**
 * Çevirme planını hesaplar. Bir önceki konuya asla inmez (listLength >= 2 iken).
 * currentIndex -1 olabilir (henüz konu seçilmemiş) — bu durumda her indekse inebilir.
 */
export function planSpin(
  currentIndex: number,
  listLength: number,
  rng: () => number = Math.random,
): SpinPlan {
  if (listLength <= 0) {
    throw new Error('listLength pozitif olmalı');
  }
  if (listLength === 1) {
    return { totalSteps: 0, landIndex: 0 };
  }
  const fullTurns = 3 + Math.floor(rng() * 3); // 3..5 tam tur

  if (currentIndex < 0) {
    // Henüz seçili konu yok: kısıtlama gerekmez, herhangi bir indekse inebilir.
    const offset = Math.floor(rng() * listLength); // [0, listLength-1]
    const totalSteps = fullTurns * listLength + offset;
    return { totalSteps, landIndex: offset };
  }

  const offset = 1 + Math.floor(rng() * (listLength - 1)); // [1, listLength-1]
  const totalSteps = fullTurns * listLength + offset;
  const landIndex = (((currentIndex + totalSteps) % listLength) + listLength) % listLength;
  return { totalSteps, landIndex };
}

/** [0, listLength) aralığında rastgele bir indeks döndürür. */
export function randomIndex(listLength: number, rng: () => number = Math.random): number {
  if (listLength <= 0) {
    throw new Error('listLength pozitif olmalı');
  }
  return Math.floor(rng() * listLength);
}

/** Kübik ease-out: hızlı başlar, yavaşça durur. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

/** Verilen ilerleme (0..1) ve toplam adım sayısına göre o ana kadar atılmış adım sayısı. */
export function stepAt(progress01: number, totalSteps: number): number {
  const eased = easeOutCubic(progress01);
  return Math.floor(eased * totalSteps);
}
