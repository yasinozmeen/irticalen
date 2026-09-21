import type { Locale } from './types';
import type { SpinPlan } from './topicPicker';
import type { StorageLike } from './settings';

/**
 * Shuffle bag: a topic does not come back until every other topic in its category has been drawn.
 * Seen topics are stored as text (not indices) so reordering or editing a list never marks the
 * wrong topic as seen.
 */

const KEY_PREFIX = 'irticalen:seen';

function defaultStorage(): StorageLike | undefined {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return (globalThis as unknown as { localStorage: StorageLike }).localStorage;
    }
  } catch {
    // ignore when inaccessible
  }
  return undefined;
}

function seenKey(locale: Locale, categoryId: string): string {
  return `${KEY_PREFIX}:${locale}:${categoryId}`;
}

/** Reads the seen list for a category; missing/corrupt data → empty list. Never throws. */
export function loadSeen(
  locale: Locale,
  categoryId: string,
  storage: StorageLike | undefined = defaultStorage(),
): string[] {
  try {
    const raw = storage?.getItem(seenKey(locale, categoryId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

/** Saves the seen list for a category. Never throws. */
export function saveSeen(
  locale: Locale,
  categoryId: string,
  seen: string[],
  storage: StorageLike | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(seenKey(locale, categoryId), JSON.stringify(seen));
  } catch {
    // ignore when storage is full/blocked
  }
}

export interface BagDraw {
  index: number;
  /** The seen list after this draw (includes the drawn topic). */
  seen: string[];
}

/**
 * Draws a topic that has not been seen yet. When the bag is empty it starts over — but still never
 * returns the topic currently on screen (when there are at least two topics).
 */
export function drawFromBag(
  topics: readonly string[],
  seen: readonly string[],
  currentIndex: number,
  rng: () => number = Math.random,
): BagDraw {
  if (topics.length <= 0) {
    throw new Error('topics must not be empty');
  }
  if (topics.length === 1) {
    return { index: 0, seen: [topics[0]] };
  }

  const seenSet = new Set(seen);
  const candidatesFor = (excluded: Set<string>): number[] =>
    topics.map((_, i) => i).filter((i) => i !== currentIndex && !excluded.has(topics[i]));

  let carried = seen.filter((topic) => topics.includes(topic));
  let candidates = candidatesFor(seenSet);
  if (candidates.length === 0) {
    // Start over, but keep the topic on screen in the new round so it cannot come back right away.
    carried = currentIndex >= 0 && currentIndex < topics.length ? [topics[currentIndex]] : [];
    candidates = candidatesFor(new Set());
  }

  const index = candidates[Math.floor(rng() * candidates.length)];
  return { index, seen: [...carried, topics[index]] };
}

/** A spin plan that lands on a chosen index (3–5 full turns, like `planSpin`). */
export function planSpinTo(
  currentIndex: number,
  listLength: number,
  landIndex: number,
  rng: () => number = Math.random,
): SpinPlan {
  if (listLength <= 0) {
    throw new Error('listLength must be positive');
  }
  if (listLength === 1) {
    return { totalSteps: 0, landIndex: 0 };
  }
  const base = currentIndex >= 0 ? currentIndex : 0;
  const fullTurns = 3 + Math.floor(rng() * 3);
  const offset = (((landIndex - base) % listLength) + listLength) % listLength;
  return { totalSteps: fullTurns * listLength + offset, landIndex };
}
