import { describe, expect, it } from 'vitest';
import {
  clampMinutes,
  DEFAULT_RESEARCH_SEC,
  DEFAULT_SPEECH_SEC,
  loadLocale,
  loadSettings,
  saveLocale,
  saveSettings,
  type StorageLike,
} from '../settings';

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

describe('clampMinutes', () => {
  it('sınırları kırpar', () => {
    expect(clampMinutes('speech', 0)).toBe(1);
    expect(clampMinutes('speech', 11)).toBe(10);
    expect(clampMinutes('speech', 5)).toBe(5);
    expect(clampMinutes('research', 0)).toBe(1);
    expect(clampMinutes('research', 61)).toBe(60);
    expect(clampMinutes('research', 30)).toBe(30);
  });

  it('yuvarlar', () => {
    expect(clampMinutes('speech', 5.6)).toBe(6);
  });

  it('NaN varsayılana düşer', () => {
    expect(clampMinutes('speech', NaN)).toBe(DEFAULT_SPEECH_SEC / 60);
    expect(clampMinutes('research', NaN)).toBe(DEFAULT_RESEARCH_SEC / 60);
  });
});

describe('loadSettings', () => {
  it('storage hiç yoksa varsayılana düşer', () => {
    const settings = loadSettings(undefined);
    expect(settings.speechSec).toBe(DEFAULT_SPEECH_SEC);
    expect(settings.researchSec).toBe(DEFAULT_RESEARCH_SEC);
    expect(settings.muted).toBe(false);
  });

  it('bozuk değerler varsayılana düşer', () => {
    const storage = memoryStorage({
      'irticalen:speech': 'abc',
      'irticalen:research': '-5',
      'irticalen:muted': 'evet',
    });
    const settings = loadSettings(storage);
    expect(settings.speechSec).toBe(DEFAULT_SPEECH_SEC);
    // -5 saniye -> clamp min'e düşer (1 dk = 60 sn), fallback değil ama sınırda
    expect(settings.researchSec).toBeGreaterThanOrEqual(60);
    expect(settings.muted).toBe(false);
  });

  it('aşırı büyük değer kırpılır', () => {
    const storage = memoryStorage({ 'irticalen:research': '99999' });
    const settings = loadSettings(storage);
    expect(settings.researchSec).toBe(60 * 60); // 60 dk üst sınır
  });

  it('boş string varsayılana düşer', () => {
    const storage = memoryStorage({ 'irticalen:speech': '' });
    const settings = loadSettings(storage);
    expect(settings.speechSec).toBe(DEFAULT_SPEECH_SEC);
  });

  it('getItem fırlatan storage ile patlamaz, varsayılana düşer', () => {
    const settings = loadSettings(throwingStorage());
    expect(settings.speechSec).toBe(DEFAULT_SPEECH_SEC);
    expect(settings.researchSec).toBe(DEFAULT_RESEARCH_SEC);
    expect(settings.muted).toBe(false);
  });

  it('geçerli değerleri doğru okur', () => {
    const storage = memoryStorage({
      'irticalen:speech': '180',
      'irticalen:research': '1200',
      'irticalen:muted': 'true',
    });
    const settings = loadSettings(storage);
    expect(settings.speechSec).toBe(180);
    expect(settings.researchSec).toBe(1200);
    expect(settings.muted).toBe(true);
  });
});

describe('saveSettings', () => {
  it('setItem fırlatan storage ile patlamaz', () => {
    expect(() => saveSettings({ speechSec: 120 }, throwingStorage())).not.toThrow();
  });

  it('storage yoksa patlamaz', () => {
    expect(() => saveSettings({ speechSec: 120 }, undefined)).not.toThrow();
  });

  it('kaydedilen değer loadSettings ile geri okunur', () => {
    const storage = memoryStorage();
    saveSettings({ speechSec: 300, researchSec: 900, muted: true }, storage);
    const settings = loadSettings(storage);
    expect(settings.speechSec).toBe(300);
    expect(settings.researchSec).toBe(900);
    expect(settings.muted).toBe(true);
  });

  it('süreyi gizleme tercihi kaydedilir; kayıt yoksa ya da bozuksa görünür kalır', () => {
    expect(loadSettings(memoryStorage()).hideClock).toBe(false);
    expect(loadSettings(memoryStorage({ 'irticalen:hideClock': 'evet' })).hideClock).toBe(false);
    expect(loadSettings(throwingStorage()).hideClock).toBe(false);
    const storage = memoryStorage();
    saveSettings({ hideClock: true }, storage);
    expect(loadSettings(storage).hideClock).toBe(true);
    saveSettings({ hideClock: false }, storage);
    expect(loadSettings(storage).hideClock).toBe(false);
  });
});

describe('locale', () => {
  it('kayıtlı değer yoksa tr döner', () => {
    expect(loadLocale(memoryStorage())).toBe('tr');
  });

  it('bozuk değer varsa tr döner', () => {
    expect(loadLocale(memoryStorage({ 'irticalen:lang': 'xx' }))).toBe('tr');
  });

  it('storage fırlatırsa tr döner', () => {
    expect(loadLocale(throwingStorage())).toBe('tr');
  });

  it('en kaydedilip okunabilir', () => {
    const storage = memoryStorage();
    saveLocale('en', storage);
    expect(loadLocale(storage)).toBe('en');
  });

  it('saveLocale fırlatan storage ile patlamaz', () => {
    expect(() => saveLocale('en', throwingStorage())).not.toThrow();
  });
});
