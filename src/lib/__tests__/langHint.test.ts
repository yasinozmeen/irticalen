import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../settings';
import { loadLangHintSeen, prefersTurkish, saveLangHintSeen, shouldShowLangHint } from '../langHint';

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
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

describe('prefersTurkish', () => {
  it('tr veya tr-TR gibi etiketleri tanır', () => {
    expect(prefersTurkish(['tr'])).toBe(true);
    expect(prefersTurkish(['tr-TR'])).toBe(true);
    expect(prefersTurkish(['en-US', 'tr-TR'])).toBe(true);
  });

  it('türkçe olmayan listede false döner', () => {
    expect(prefersTurkish(['en-US', 'de-DE'])).toBe(false);
    expect(prefersTurkish([])).toBe(false);
  });
});

describe('shouldShowLangHint', () => {
  it('tr sayfada tarayıcı türkçe değilse ipucu gösterilir', () => {
    expect(shouldShowLangHint('tr', ['en-US'], false)).toBe(true);
  });

  it('tr sayfada tarayıcı türkçeyse ipucu gösterilmez', () => {
    expect(shouldShowLangHint('tr', ['tr-TR'], false)).toBe(false);
  });

  it('en sayfada tarayıcı türkçeyse ipucu gösterilir', () => {
    expect(shouldShowLangHint('en', ['tr-TR'], false)).toBe(true);
  });

  it('en sayfada tarayıcı türkçe değilse ipucu gösterilmez', () => {
    expect(shouldShowLangHint('en', ['en-US'], false)).toBe(false);
  });

  it('daha önce görülmüşse (seen) hiçbir zaman gösterilmez', () => {
    expect(shouldShowLangHint('tr', ['en-US'], true)).toBe(false);
    expect(shouldShowLangHint('en', ['tr-TR'], true)).toBe(false);
  });
});

describe('loadLangHintSeen / saveLangHintSeen', () => {
  it('storage yoksa görülmemiş sayılır', () => {
    expect(loadLangHintSeen(undefined)).toBe(false);
  });

  it('kaydedilince geri okunur', () => {
    const storage = memoryStorage();
    expect(loadLangHintSeen(storage)).toBe(false);
    saveLangHintSeen(storage);
    expect(loadLangHintSeen(storage)).toBe(true);
  });

  it('fırlatan storage ile patlamaz', () => {
    expect(loadLangHintSeen(throwingStorage())).toBe(false);
    expect(() => saveLangHintSeen(throwingStorage())).not.toThrow();
  });
});
