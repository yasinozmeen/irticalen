import type { StorageLike } from './settings';
import type { Category } from './types';

/**
 * Pseudo field id meaning "no group filter — every topic in the pool". Doubles as the historical
 * topic-bag key suffix (see `researchBagKey`) so visitors who already had a "deep-research" seen
 * list keep it once the field selector ships.
 */
export const ALL_FIELD_ID = 'all';

const KEY_RESEARCH_FIELD = 'irticalen:researchField';

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

/**
 * Resolves a candidate field id against the category's current group ids. Missing, unknown (a
 * renamed/removed group) or otherwise invalid values fall back to `ALL_FIELD_ID`. Pure.
 */
export function normalizeResearchField(
  candidate: string | null | undefined,
  validIds: readonly string[],
): string {
  if (candidate && validIds.includes(candidate)) return candidate;
  return ALL_FIELD_ID;
}

/** Reads the saved research field; falls back to `ALL_FIELD_ID` if missing/corrupt. Never throws. */
export function loadResearchField(
  validIds: readonly string[],
  storage: StorageLike | undefined = defaultStorage(),
): string {
  try {
    return normalizeResearchField(storage?.getItem(KEY_RESEARCH_FIELD) ?? null, validIds);
  } catch {
    return ALL_FIELD_ID;
  }
}

/** Saves the research field. Never throws. */
export function saveResearchField(
  fieldId: string,
  storage: StorageLike | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(KEY_RESEARCH_FIELD, fieldId);
  } catch {
    // ignore when storage is full/blocked
  }
}

/**
 * The topic list for a given field id: the whole category's topics for `ALL_FIELD_ID`, or a single
 * group's topics otherwise. An unknown field id (stale storage after a group rename) falls back to
 * the whole category rather than an empty wheel.
 */
export function topicsForField(category: Category | undefined, fieldId: string): string[] {
  if (!category) return [];
  if (fieldId === ALL_FIELD_ID) return category.topics;
  return category.groups?.find((group) => group.id === fieldId)?.topics ?? category.topics;
}

/**
 * The topic-bag (seen-list) storage key for a category + field: the bare category id for "Hepsi"
 * (`ALL_FIELD_ID`) — so an existing visitor's seen list is unaffected — and `<categoryId>:<fieldId>`
 * for a specific field, kept separate so switching fields doesn't skip topics from the other field's
 * bag.
 */
export function researchBagKey(categoryId: string, fieldId: string): string {
  return fieldId === ALL_FIELD_ID ? categoryId : `${categoryId}:${fieldId}`;
}
