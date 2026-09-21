// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://irticalen.yasinozmeen.me',
  i18n: {
    defaultLocale: 'tr',
    locales: ['tr', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    preact(),
    sitemap({ i18n: { defaultLocale: 'tr', locales: { tr: 'tr-TR', en: 'en-US' } } }),
  ],
});
