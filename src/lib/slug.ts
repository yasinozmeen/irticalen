import { getAllCategories } from '../data/topics';
import type { Locale } from './types';

// Applied AFTER locale-aware lowercasing, so 'İ' → 'i' and 'I' → 'ı' (Turkish locale rule) both land here.
const ASCII_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
};

/**
 * URL-safe slug: locale-aware lowercasing first (so Turkish İ/I fold correctly), then Turkish
 * transliteration, then non-alphanumeric → `-`, then trims/collapses dashes. Pure.
 */
export function slugify(text: string, locale: Locale): string {
  let out = text.toLocaleLowerCase(locale);
  let mapped = '';
  for (const ch of out) {
    mapped += ASCII_MAP[ch] ?? ch;
  }
  out = mapped.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  out = out.replace(/[^a-z0-9]+/g, '-');
  out = out.replace(/^-+|-+$/g, '');
  out = out.replace(/-{2,}/g, '-');
  return out;
}

export interface TopicIndexEntry {
  slug: string;
  topic: string;
  categoryId: string;
  categoryName: string;
}

/**
 * Builds a slug index across every category (including the deep-research pool) for a locale.
 * Deterministic collision handling: the first occurrence (source list order) keeps the bare slug,
 * every later occurrence gets `-<categoryId>` appended.
 */
export function buildTopicIndex(locale: Locale): TopicIndexEntry[] {
  const seenSlugs = new Set<string>();
  const entries: TopicIndexEntry[] = [];

  for (const category of getAllCategories(locale)) {
    for (const topic of category.topics) {
      const base = slugify(topic, locale);
      // A topic made only of symbols would produce an empty slug and a broken route — fail the build
      // loudly instead of publishing it.
      if (base === '') throw new Error(`Topic "${topic}" (${locale}/${category.id}) has no usable slug`);
      let slug = base;
      if (seenSlugs.has(slug)) slug = `${base}-${category.id}`;
      for (let n = 2; seenSlugs.has(slug); n += 1) slug = `${base}-${category.id}-${n}`;
      seenSlugs.add(slug);
      entries.push({ slug, topic, categoryId: category.id, categoryName: category.label });
    }
  }

  return entries;
}
