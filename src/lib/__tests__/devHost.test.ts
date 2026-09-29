import { describe, expect, it } from 'vitest';
import { isDevHost } from '../devHost';

describe('isDevHost', () => {
  it('canlı sitede asla geliştirme sayılmaz', () => {
    expect(isDevHost('irticalen.yasinozmeen.me')).toBe(false);
  });

  it('localhost, ağ adresi ve test tüneli geliştirme sayılır', () => {
    expect(isDevHost('localhost')).toBe(true);
    expect(isDevHost('192.168.1.20')).toBe(true);
    expect(isDevHost('fired-experiences-politicians-views.trycloudflare.com')).toBe(true);
  });
});
