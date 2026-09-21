/** Total spin animation duration (ms). */
export const SPIN_DURATION_MS = 4800;
/** Spin safety timeout (ms) — the animation is guaranteed to end by this time. */
export const SPIN_SAFETY_MS = 5100;

/** The plan for one spin: how many steps to take and where it lands. */
export interface SpinPlan {
  totalSteps: number;
  landIndex: number;
}

/**
 * Computes the spin plan. Never lands on the previous topic (when listLength >= 2).
 * currentIndex may be -1 (no topic selected yet) — in that case it can land on any index.
 */
export function planSpin(
  currentIndex: number,
  listLength: number,
  rng: () => number = Math.random,
): SpinPlan {
  if (listLength <= 0) {
    throw new Error('listLength must be positive');
  }
  if (listLength === 1) {
    return { totalSteps: 0, landIndex: 0 };
  }
  const fullTurns = 3 + Math.floor(rng() * 3); // 3..5 tam tur

  if (currentIndex < 0) {
    // No topic selected yet: no restriction needed, it can land on any index.
    const offset = Math.floor(rng() * listLength); // [0, listLength-1]
    const totalSteps = fullTurns * listLength + offset;
    return { totalSteps, landIndex: offset };
  }

  const offset = 1 + Math.floor(rng() * (listLength - 1)); // [1, listLength-1]
  const totalSteps = fullTurns * listLength + offset;
  const landIndex = (((currentIndex + totalSteps) % listLength) + listLength) % listLength;
  return { totalSteps, landIndex };
}

/** Returns a random index in [0, listLength). */
export function randomIndex(listLength: number, rng: () => number = Math.random): number {
  if (listLength <= 0) {
    throw new Error('listLength must be positive');
  }
  return Math.floor(rng() * listLength);
}

/** Cubic ease-out: starts fast, slows to a stop. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

/** Given progress (0..1) and the total step count, how many steps have been taken so far. */
export function stepAt(progress01: number, totalSteps: number): number {
  const eased = easeOutCubic(progress01);
  return Math.floor(eased * totalSteps);
}

/**
 * Fractional wheel position for a given progress (0..1) and total step count.
 * `stepAt` is the floor of this value — they stay consistent by construction,
 * and both equal `totalSteps` at progress = 1.
 */
export function positionAt(progress01: number, totalSteps: number): number {
  const eased = easeOutCubic(progress01);
  return eased * totalSteps;
}

/**
 * The step number a given wheel face should display at a fractional `position`.
 * Among all integers `n` congruent to `faceIndex` modulo `faceCount`, returns the
 * one closest to `position` (a UIPickerView-style drum: each face shows whichever
 * step wraps onto it nearest the current rotation).
 */
export function wheelFaceStep(faceIndex: number, faceCount: number, position: number): number {
  const s = Math.round(position);
  let d = (((faceIndex - s) % faceCount) + faceCount) % faceCount;
  if (d > faceCount / 2) d -= faceCount;
  return s + d;
}

/** Wraps an index into [0, length), correctly handling negative indices. */
export function wrapIndex(i: number, length: number): number {
  return ((i % length) + length) % length;
}
