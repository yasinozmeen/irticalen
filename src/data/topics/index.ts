import type { Category, Locale } from '../../lib/types';
import { flattenAllCategoryGroups } from '../../lib/categoryGroups';
// Topic data is authored elsewhere (see docs/SPEC.md ownership notes). If these
// JSON files are missing, the build fails here on purpose — see project report.
import trTopics from './tr.json';
import enTopics from './en.json';

// A category authored with `groups` (currently only `deep-research`) has no `topics` of its own in
// the JSON — it's filled in here as the groups' topics concatenated in group order, so every other
// consumer (topic pages, OG cards, buildTopicIndex, the wheel) keeps reading `category.topics` and
// never has to know about groups.
const byLocale: Record<Locale, Category[]> = {
  tr: flattenAllCategoryGroups(trTopics as Category[]),
  en: flattenAllCategoryGroups(enTopics as Category[]),
};

/** Returns the category list for a locale, excluding the deep-research pool. */
export function getCategories(locale: Locale): Category[] {
  return byLocale[locale].filter((category) => category.id !== 'deep-research');
}

/** Returns a single category by id (including deep-research), or undefined if not found. */
export function getCategoryById(locale: Locale, id: string): Category | undefined {
  return byLocale[locale].find((category) => category.id === id);
}

/** Every category for a locale, in source order, including the deep-research pool. */
export function getAllCategories(locale: Locale): Category[] {
  return byLocale[locale];
}
