import { describe, expect, it } from 'vitest';
import { buildShareText, shareUrl, twitterIntentUrl } from '../share';

describe('buildShareText', () => {
  it('{topic} ve {min} yerlerini doldurur, konu olduğu gibi kalır', () => {
    const text = buildShareText('“{topic}” üzerine {min} dakika irticalen konuştum. Sıra sende:', {
      topic: 'Bileşik Faiz',
      minutes: 3,
    });
    expect(text).toBe('“Bileşik Faiz” üzerine 3 dakika irticalen konuştum. Sıra sende:');
  });

  it('İngilizce şablonla da çalışır', () => {
    const text = buildShareText('I just spoke off the cuff for {min} min about “{topic}”. Your turn:', {
      topic: 'Compound interest',
      minutes: 1,
    });
    expect(text).toBe('I just spoke off the cuff for 1 min about “Compound interest”. Your turn:');
  });

  it('tekrar eden placeholder olsa bile hepsini doldurur', () => {
    const text = buildShareText('{topic} - {topic} ({min})', { topic: 'x', minutes: 2 });
    expect(text).toBe('x - x (2)');
  });
});

describe('shareUrl', () => {
  it('tr için kök adres döner', () => {
    expect(shareUrl('tr')).toBe('https://irticalen.yasinozmeen.me/');
  });

  it('en için /en/ döner', () => {
    expect(shareUrl('en')).toBe('https://irticalen.yasinozmeen.me/en/');
  });
});

describe('twitterIntentUrl', () => {
  it('metin ve adresi kodlayarak intent url üretir', () => {
    const url = twitterIntentUrl('a b “c”', 'https://irticalen.yasinozmeen.me/');
    expect(url).toBe(
      'https://x.com/intent/post?text=' +
        encodeURIComponent('a b “c”') +
        '&url=' +
        encodeURIComponent('https://irticalen.yasinozmeen.me/'),
    );
    expect(url.startsWith('https://x.com/intent/post?')).toBe(true);
  });
});
