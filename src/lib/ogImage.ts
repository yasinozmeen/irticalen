import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { Locale } from './types';
import { computeOgLayout } from './ogLayout';

const WIDTH = 1200;
const HEIGHT = 630;

const PAPER = '#f3eee2';
const INK = '#1d1a16';
const PENCIL = '#6f695c';
const RULE = '#d6cfbf';
const RED = '#b8281c';

// Built with process.cwd(), not import.meta.url: Astro bundles this module into a build chunk
// under dist/.prerender/chunks, which breaks relative-to-source-file resolution. The build (and
// dev/preview) always runs from the project root, so cwd-relative is the reliable option here.
function fontPath(file: string): string {
  return join(process.cwd(), 'src/assets/fonts', file);
}

let fontsCache: { name: string; data: Buffer; weight: 400 | 500 | 700; style: 'normal' | 'italic' }[] | null = null;

function loadFonts() {
  if (fontsCache) return fontsCache;
  fontsCache = [
    { name: 'Newsreader', data: readFileSync(fontPath('Newsreader-Regular.ttf')), weight: 400, style: 'normal' },
    { name: 'Newsreader', data: readFileSync(fontPath('Newsreader-Bold.ttf')), weight: 700, style: 'normal' },
    {
      name: 'Newsreader',
      data: readFileSync(fontPath('Newsreader-MediumItalic.ttf')),
      weight: 500,
      style: 'italic',
    },
  ];
  return fontsCache;
}

// satori accepts plain {type, props} nodes shaped like React elements — no JSX pragma needed.
function el(type: string, props: Record<string, unknown> = {}, children?: unknown) {
  return { type, props: { ...props, ...(children !== undefined ? { children } : {}) } };
}

const TAGLINE: Record<Locale, string> = {
  tr: 'Rastgele konu. Bir dakika. Yüksek sesle konuş.',
  en: 'A random topic. One minute. Speak out loud.',
};

const YOUR_TOPIC: Record<Locale, string> = {
  tr: 'konun',
  en: 'your topic',
};

function logoMark() {
  const bubble = '0,0 92,0 92,70 40,70 14,94 14,70 0,70';
  const marksX = [22, 46, 70];
  return el(
    'svg',
    { width: 46, height: 47, viewBox: '0 0 100 102' },
    [
      el('polygon', { points: bubble, fill: INK, key: 'bubble' }),
      ...marksX.map((x, i) =>
        el('polygon', {
          key: `d${i}`,
          points: `${x},25 ${x + 10},35 ${x},45 ${x - 10},35`,
          fill: i === 1 ? RED : PAPER,
        }),
      ),
    ],
  );
}

/** Renders a topic's 1200×630 OG PNG. Pure aside from font file reads — no network. */
export async function renderTopicOgPng(topic: string, locale: Locale): Promise<Buffer> {
  const fonts = loadFonts();
  const layout = computeOgLayout(topic, locale);

  const lineStyle = {
    display: 'flex',
    fontWeight: 700,
    fontSize: layout.fontSizePx,
    lineHeight: 1.04,
    letterSpacing: '-0.01em',
    color: INK,
  } as const;

  const lines = layout.lines.map((line, i) => {
    const isLast = i === layout.lines.length - 1;
    if (!isLast) {
      return el('div', { key: `line-${i}`, style: lineStyle }, line);
    }
    // Red dot appended to the last line as its own coloured span, kept on the same row.
    return el('div', { key: `line-${i}`, style: lineStyle }, [
      el('span', { key: 'txt' }, line),
      el('span', { key: 'dot', style: { color: RED } }, '.'),
    ]);
  });

  const tree = el(
    'div',
    {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: PAPER,
        padding: '56px 64px',
        fontFamily: 'Newsreader',
        color: INK,
      },
    },
    [
      el(
        'div',
        {
          key: 'top',
          style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
        },
        [
          el('div', { key: 'brand', style: { display: 'flex', alignItems: 'center' } }, [
            logoMark(),
            el(
              'span',
              { key: 'word', style: { marginLeft: 14, fontSize: 30, fontWeight: 700, color: INK } },
              'irticalen',
            ),
            el('span', { key: 'dot', style: { fontSize: 30, fontWeight: 700, color: RED } }, '.'),
          ]),
          el(
            'div',
            {
              key: 'domain',
              style: {
                display: 'flex',
                fontSize: 22,
                color: PENCIL,
                textDecoration: 'underline',
              },
            },
            'irticalen.yasinozmeen.me',
          ),
        ],
      ),
      el('div', { key: 'rule-top', style: { display: 'flex', width: '100%', height: 1, background: RULE, marginTop: 28 } }),
      el(
        'div',
        {
          key: 'mid',
          style: {
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            justifyContent: 'center',
            gap: 6,
          },
        },
        [
          el(
            'div',
            { key: 'label', style: { display: 'flex', fontStyle: 'italic', fontWeight: 500, fontSize: 26, color: PENCIL, marginBottom: 8 } },
            YOUR_TOPIC[locale],
          ),
          ...lines,
        ],
      ),
      el('div', { key: 'rule-bottom', style: { display: 'flex', width: '100%', height: 1, background: RULE, marginBottom: 20 } }),
      el(
        'div',
        { key: 'tagline', style: { display: 'flex', fontSize: 20, color: PENCIL } },
        TAGLINE[locale],
      ),
    ],
  );

  const svg = await satori(tree, { width: WIDTH, height: HEIGHT, fonts });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } });
  const png = resvg.render().asPng();
  return Buffer.from(png);
}
