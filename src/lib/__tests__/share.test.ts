import { describe, expect, it } from 'vitest';
import { shareText, shareUrl, topicPageUrl, xIntentUrl, whatsappUrl } from '../share';

describe('shareText', () => {
  it('{topic} ve {min} yerlerini doldurur, konu olduğu gibi kalır', () => {
    const text = shareText('“{topic}” üzerine {min} dakika irticalen konuştum. Sıra sende:', {
      topic: 'Bileşik Faiz',
      minutes: 3,
    });
    expect(text).toBe('“Bileşik Faiz” üzerine 3 dakika irticalen konuştum. Sıra sende:');
  });

  it('İngilizce şablonla da çalışır', () => {
    const text = shareText('I just spoke off the cuff for {min} min about “{topic}”. Your turn:', {
      topic: 'Compound interest',
      minutes: 1,
    });
    expect(text).toBe('I just spoke off the cuff for 1 min about “Compound interest”. Your turn:');
  });

  it('tekrar eden placeholder olsa bile hepsini doldurur', () => {
    const text = shareText('{topic} - {topic} ({min})', { topic: 'x', minutes: 2 });
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

describe('topicPageUrl', () => {
  it('tr için /konu/<slug>/ döner', () => {
    expect(topicPageUrl('tr', 'bilesik-faiz')).toBe('https://irticalen.yasinozmeen.me/konu/bilesik-faiz/');
  });

  it('en için /en/topic/<slug>/ döner', () => {
    expect(topicPageUrl('en', 'compound-interest')).toBe(
      'https://irticalen.yasinozmeen.me/en/topic/compound-interest/',
    );
  });
});

describe('xIntentUrl', () => {
  it('metin ve adresi kodlayarak intent url üretir', () => {
    const url = xIntentUrl('a b “c”', 'https://irticalen.yasinozmeen.me/');
    expect(url).toBe(
      'https://x.com/intent/post?text=' +
        encodeURIComponent('a b “c”') +
        '&url=' +
        encodeURIComponent('https://irticalen.yasinozmeen.me/'),
    );
    expect(url.startsWith('https://x.com/intent/post?')).toBe(true);
  });
});

describe('whatsappUrl', () => {
  it('metin + boşluk + url kodlanır', () => {
    const url = whatsappUrl('metin', 'https://irticalen.yasinozmeen.me/konu/x/');
    expect(url).toBe(
      'https://wa.me/?text=' + encodeURIComponent('metin https://irticalen.yasinozmeen.me/konu/x/'),
    );
  });
});
