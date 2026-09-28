import { describe, expect, it } from 'vitest';
import {
  ALL_FIELD_ID,
  loadResearchField,
  normalizeResearchField,
  researchBagKey,
  saveResearchField,
  topicsForField,
} from '../researchField';
import type { StorageLike } from '../settings';
import type { Category } from '../types';

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key)! : null),
    setItem: (key, value) => void data.set(key, value),
  };
}

function throwingStorage(): StorageLike {
  return {
    getItem() {
      throw new Error('boom');
    },
    setItem() {
      throw new Error('boom');
    },
  };
}

const VALID_IDS = ['mind', 'economics', 'laws', 'science'];

describe('normalizeResearchField', () => {
  it('keeps a known field id', () => {
    expect(normalizeResearchField('mind', VALID_IDS)).toBe('mind');
  });

  it('falls back to ALL_FIELD_ID for missing, unknown or stale values', () => {
    expect(normalizeResearchField(null, VALID_IDS)).toBe(ALL_FIELD_ID);
    expect(normalizeResearchField(undefined, VALID_IDS)).toBe(ALL_FIELD_ID);
    expect(normalizeResearchField('', VALID_IDS)).toBe(ALL_FIELD_ID);
    expect(normalizeResearchField('renamed-group', VALID_IDS)).toBe(ALL_FIELD_ID);
  });
});

describe('loadResearchField / saveResearchField', () => {
  it('loads ALL_FIELD_ID when nothing was saved', () => {
    expect(loadResearchField(VALID_IDS, memoryStorage())).toBe(ALL_FIELD_ID);
  });

  it('round-trips a saved valid field', () => {
    const storage = memoryStorage();
    saveResearchField('economics', storage);
    expect(loadResearchField(VALID_IDS, storage)).toBe('economics');
  });

  it('falls back to ALL_FIELD_ID for a stale saved value (e.g. a removed group)', () => {
    const storage = memoryStorage({ 'irticalen:researchField': 'no-longer-exists' });
    expect(loadResearchField(VALID_IDS, storage)).toBe(ALL_FIELD_ID);
  });

  it('never throws when storage is missing or broken', () => {
    expect(loadResearchField(VALID_IDS, undefined)).toBe(ALL_FIELD_ID);
    expect(loadResearchField(VALID_IDS, throwingStorage())).toBe(ALL_FIELD_ID);
    expect(() => saveResearchField('mind', throwingStorage())).not.toThrow();
  });
});

const CATEGORY: Category = {
  id: 'deep-research',
  label: 'Araştırmalı',
  topics: ['a', 'b', 'c', 'd'],
  groups: [
    { id: 'mind', label: 'Zihin', topics: ['a', 'b'] },
    { id: 'economics', label: 'Ekonomi', topics: ['c', 'd'] },
  ],
};

describe('topicsForField', () => {
  it('returns the whole category for ALL_FIELD_ID', () => {
    expect(topicsForField(CATEGORY, ALL_FIELD_ID)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns a single group topic list for a known field id', () => {
    expect(topicsForField(CATEGORY, 'mind')).toEqual(['a', 'b']);
    expect(topicsForField(CATEGORY, 'economics')).toEqual(['c', 'd']);
  });

  it('falls back to the whole category for an unknown field id', () => {
    expect(topicsForField(CATEGORY, 'gone')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns an empty list when the category itself is missing', () => {
    expect(topicsForField(undefined, ALL_FIELD_ID)).toEqual([]);
    expect(topicsForField(undefined, 'mind')).toEqual([]);
  });
});

describe('researchBagKey', () => {
  it('is the bare category id for ALL_FIELD_ID (keeps existing visitors\' seen list)', () => {
    expect(researchBagKey('deep-research', ALL_FIELD_ID)).toBe('deep-research');
  });

  it('is category:field for a specific field', () => {
    expect(researchBagKey('deep-research', 'mind')).toBe('deep-research:mind');
  });
});
