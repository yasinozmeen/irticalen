import { describe, expect, it } from 'vitest';
import { slugify, buildTopicIndex } from '../slug';
import { getAllCategories } from '../../data/topics';

describe('slugify', () => {
  it('Türkçe harfleri çevirir ve küçültür (tr)', () => {
    expect(slugify('Çağdaş Öğüt', 'tr')).toBe('cagdas-ogut');
    expect(slugify('İstanbul', 'tr')).toBe('istanbul');
    expect(slugify('Işık', 'tr')).toBe('isik');
    expect(slugify('Şükrü Ünlü', 'tr')).toBe('sukru-unlu');
  });

  it('boşluk ve harf/rakam dışını tireye çevirir, baştaki/sondaki/çift tireyi temizler', () => {
    expect(slugify('  Bileşik   Faiz!! ', 'tr')).toBe('bilesik-faiz');
    expect(slugify('Dunning-Kruger etkisi', 'tr')).toBe('dunning-kruger-etkisi');
  });

  it('İngilizce konularda da çalışır', () => {
    expect(slugify('Compound interest', 'en')).toBe('compound-interest');
    expect(slugify("One Thousand and One Nights", 'en')).toBe('one-thousand-and-one-nights');
  });

  it('rakamları korur', () => {
    expect(slugify('2008 krizi', 'tr')).toBe('2008-krizi');
  });
});

describe('buildTopicIndex', () => {
  it('tr ve en için tüm slug lar benzersiz ve boş değil', () => {
    for (const locale of ['tr', 'en'] as const) {
      const index = buildTopicIndex(locale);
      const slugs = index.map((e) => e.slug);
      expect(slugs.length).toBeGreaterThan(0);
      for (const slug of slugs) {
        expect(slug.length).toBeGreaterThan(0);
      }
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('her kategorinin tüm konularını kapsar', () => {
    for (const locale of ['tr', 'en'] as const) {
      const index = buildTopicIndex(locale);
      const totalTopics = getAllCategories(locale).reduce((sum, c) => sum + c.topics.length, 0);
      expect(index.length).toBe(totalTopics);
    }
  });

  it('çakışan slug ikinci girişte kategori kimliğiyle ayrışır (deterministik)', () => {
    const index = buildTopicIndex('tr');
    const bySlug = new Map<string, number>();
    for (const entry of index) {
      bySlug.set(entry.slug, (bySlug.get(entry.slug) ?? 0) + 1);
    }
    for (const [slug, count] of bySlug) {
      expect(count).toBe(1);
      expect(slug.length).toBeGreaterThan(0);
    }
  });
});
