import type { Locale } from './types';

export interface ShareTextParams {
  topic: string;
  minutes: number;
}

/** Fills a `{topic}`/`{min}` template (from `dict.share.text`) with the finished session's values. */
export function shareText(template: string, { topic, minutes }: ShareTextParams): string {
  return template.replace(/\{topic\}/g, topic).replace(/\{min\}/g, String(minutes));
}

/** Canonical home URL for the locale. */
export function shareUrl(locale: Locale): string {
  return locale === 'tr' ? 'https://irticalen.yasinozmeen.me/' : 'https://irticalen.yasinozmeen.me/en/';
}

/** Canonical topic page URL for the locale + slug — this is what gets shared, not the home page. */
export function topicPageUrl(locale: Locale, slug: string): string {
  return locale === 'tr'
    ? `https://irticalen.yasinozmeen.me/konu/${slug}/`
    : `https://irticalen.yasinozmeen.me/en/topic/${slug}/`;
}

/** `x.com` share-intent URL. */
export function xIntentUrl(text: string, url: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

/** `wa.me` share URL: WhatsApp opens with the text + url pre-filled. */
export function whatsappUrl(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}
