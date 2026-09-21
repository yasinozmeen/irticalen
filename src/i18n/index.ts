import { tr } from './tr';
import { en } from './en';

/** Widens the literal types of the Turkish dictionary so other languages can satisfy the same shape. */
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : { readonly [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof tr>;
export type Locale = 'tr' | 'en';

export const locales: readonly Locale[] = ['tr', 'en'];
export const defaultLocale: Locale = 'tr';

export const dictionaries: Record<Locale, Dictionary> = { tr, en };

/** Path of the home page for a locale (`/` for Turkish, `/en/` for English). */
export const localePath = (locale: Locale): string => (locale === defaultLocale ? '/' : `/${locale}/`);

/** BCP 47 tag used for `<html lang>` and `hreflang`. */
export const localeTag: Record<Locale, string> = { tr: 'tr', en: 'en' };

/** Replaces `{name}` placeholders in a translated string. */
export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
