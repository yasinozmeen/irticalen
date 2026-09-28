import { describe, expect, it } from 'vitest';
import { flattenCategoryGroups, flattenAllCategoryGroups } from '../categoryGroups';
import { getAllCategories } from '../../data/topics';
import type { Category } from '../types';

describe('flattenCategoryGroups', () => {
  it('leaves a category without groups unchanged', () => {
    const category: Category = { id: 'general', label: 'Genel', topics: ['a', 'b'] };
    expect(flattenCategoryGroups(category)).toEqual(category);
  });

  it('leaves a category with an empty groups list unchanged', () => {
    const category: Category = { id: 'general', label: 'Genel', topics: ['a'], groups: [] };
    expect(flattenCategoryGroups(category)).toEqual(category);
  });

  it('concatenates group topics in group order, each group keeping its own order', () => {
    const category: Category = {
      id: 'deep-research',
      label: 'Araştırmalı',
      topics: [],
      groups: [
        { id: 'g1', label: 'Grup 1', topics: ['a', 'b'] },
        { id: 'g2', label: 'Grup 2', topics: ['c', 'd', 'e'] },
      ],
    };
    const flattened = flattenCategoryGroups(category);
    expect(flattened.topics).toEqual(['a', 'b', 'c', 'd', 'e']);
    // groups themselves are preserved (the field selector needs them)
    expect(flattened.groups).toBe(category.groups);
  });

  it('does not mutate the input category', () => {
    const category: Category = {
      id: 'deep-research',
      label: 'Araştırmalı',
      topics: [],
      groups: [{ id: 'g1', label: 'Grup 1', topics: ['a'] }],
    };
    flattenCategoryGroups(category);
    expect(category.topics).toEqual([]);
  });
});

describe('flattenAllCategoryGroups', () => {
  it('applies the flatten to every category, in source order', () => {
    const categories: Category[] = [
      { id: 'general', label: 'Genel', topics: ['x'] },
      {
        id: 'deep-research',
        label: 'Araştırmalı',
        topics: [],
        groups: [{ id: 'g1', label: 'Grup 1', topics: ['y', 'z'] }],
      },
    ];
    const result = flattenAllCategoryGroups(categories);
    expect(result.map((c) => c.id)).toEqual(['general', 'deep-research']);
    expect(result[1].topics).toEqual(['y', 'z']);
  });
});

describe('deep-research pool (real data, both locales)', () => {
  it('has a non-empty, deterministic flattened topic list per locale', () => {
    for (const locale of ['tr', 'en'] as const) {
      const category = getAllCategories(locale).find((c) => c.id === 'deep-research');
      expect(category).toBeDefined();
      expect(category!.groups?.length).toBeGreaterThan(0);
      const expected = category!.groups!.flatMap((g) => g.topics);
      expect(category!.topics).toEqual(expected);
      // no duplicate topics inside the flattened pool
      expect(new Set(category!.topics).size).toBe(category!.topics.length);
    }
  });

  it('tr and en have the same group ids, in the same order', () => {
    const tr = getAllCategories('tr').find((c) => c.id === 'deep-research');
    const en = getAllCategories('en').find((c) => c.id === 'deep-research');
    expect(tr?.groups?.map((g) => g.id)).toEqual(en?.groups?.map((g) => g.id));
  });

  it('tr and en have the same topic count per group', () => {
    const tr = getAllCategories('tr').find((c) => c.id === 'deep-research');
    const en = getAllCategories('en').find((c) => c.id === 'deep-research');
    const trCounts = tr?.groups?.map((g) => g.topics.length) ?? [];
    const enCounts = en?.groups?.map((g) => g.topics.length) ?? [];
    expect(trCounts).toEqual(enCounts);
    expect(trCounts.length).toBeGreaterThan(0);
  });
});
