import type { Category } from './types';

/**
 * Flattens a category authored with `groups` into its `topics` field — the groups' topics
 * concatenated in group order (each group's own order preserved). A category without `groups`
 * (or with an empty list) is returned unchanged, `topics` as authored.
 *
 * Pure, so the topic data loader and tests can both call it directly.
 */
export function flattenCategoryGroups(category: Category): Category {
  if (!category.groups || category.groups.length === 0) return category;
  const topics = category.groups.flatMap((group) => group.topics);
  return { ...category, topics };
}

/** Applies `flattenCategoryGroups` to every category in a locale's list, in source order. */
export function flattenAllCategoryGroups(categories: readonly Category[]): Category[] {
  return categories.map(flattenCategoryGroups);
}
