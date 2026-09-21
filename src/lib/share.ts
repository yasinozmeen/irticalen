import type { Locale } from './types';

export interface ShareTextParams {
  topic: string;
  minutes: number;
}

/** Fills a `{topic}`/`{min}` template (from `dict.share.text`) with the finished session's values. */
export function buildShareText(template: string, { topic, minutes }: ShareTextParams): string {
  return template.replace(/\{topic\}/g, topic).replace(/\{min\}/g, String(minutes));
}

/** Canonical home URL for the locale, used as the shared link. */
export function shareUrl(locale: Locale): string {
  return locale === 'tr' ? 'https://irticalen.yasinozmeen.me/' : 'https://irticalen.yasinozmeen.me/en/';
}

/** `x.com` share-intent URL as a fallback when the Web Share API is unavailable. */
export function twitterIntentUrl(text: string, url: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}
