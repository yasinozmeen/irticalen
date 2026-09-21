import type { Category, Locale } from '../../lib/types';
// Topic data is authored elsewhere (see docs/SPEC.md ownership notes). If these
// JSON files are missing, the build fails here on purpose — see project report.
import trTopics from './tr.json';
import enTopics from './en.json';

const byLocale: Record<Locale, Category[]> = {
  tr: trTopics as Category[],
  en: enTopics as Category[],
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
