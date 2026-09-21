import { localePath, localeTag, type Dictionary, type Locale } from '../i18n';
import { saveLocale } from '../lib/settings';

interface Props {
  locale: Locale;
  dict: Dictionary;
}

/** Plain link to the other locale's home page (no client-side redirect — keeps SEO intact). */
export function LanguageSwitch({ locale, dict }: Props) {
  const target: Locale = locale === 'tr' ? 'en' : 'tr';
  const href = localePath(target);

  return (
    <a
      class="chip"
      href={href}
      hreflang={localeTag[target]}
      lang={localeTag[target]}
      onClick={() => saveLocale(target)}
    >
      {dict.language.current} <span class="chip-dim">/ {dict.language.other}</span>
      <span class="sr-only"> — {dict.language.switchTo}</span>
    </a>
  );
}
