import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../settings';
import { DEFAULT_VIEW, loadView, normalizeView, saveView } from '../view';

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

describe('normalizeView', () => {
  it('yalnız "rich" zengin sayılır', () => {
    expect(normalizeView('rich')).toBe('rich');
  });

  it('eksik/bozuk/eski değerler minimalist döner', () => {
    expect(normalizeView(null)).toBe('minimal');
    expect(normalizeView(undefined)).toBe('minimal');
    expect(normalizeView('')).toBe('minimal');
    expect(normalizeView('zengin')).toBe('minimal');
    expect(normalizeView('minimal')).toBe('minimal');
  });
});

describe('loadView', () => {
  it('storage yoksa varsayılana (minimal) düşer', () => {
    expect(loadView(undefined)).toBe(DEFAULT_VIEW);
  });

  it('kayıtlı "rich" değerini okur', () => {
    expect(loadView(memoryStorage({ 'irticalen:view': 'rich' }))).toBe('rich');
  });

  it('bozuk değer minimalist döner', () => {
    expect(loadView(memoryStorage({ 'irticalen:view': 'xx' }))).toBe('minimal');
  });

  it('getItem fırlatan storage ile patlamaz', () => {
    expect(loadView(throwingStorage())).toBe('minimal');
  });
});

describe('saveView', () => {
  it('kaydedilen değer loadView ile geri okunur', () => {
    const storage = memoryStorage();
    saveView('rich', storage);
    expect(loadView(storage)).toBe('rich');
    saveView('minimal', storage);
    expect(loadView(storage)).toBe('minimal');
  });

  it('setItem fırlatan storage ile patlamaz', () => {
    expect(() => saveView('rich', throwingStorage())).not.toThrow();
  });

  it('storage yoksa patlamaz', () => {
    expect(() => saveView('rich', undefined)).not.toThrow();
  });
});
