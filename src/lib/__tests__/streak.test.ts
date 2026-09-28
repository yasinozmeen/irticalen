import { describe, expect, it } from 'vitest';
import {
  buildCalendar,
  currentStreak,
  dayKey,
  loadDays,
  longestStreak,
  practisedToday,
  recordPractice,
  type DayLog,
} from '../streak';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    raw: data,
  };
}

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe('dayKey', () => {
  it('yerel takvim gününü YYYY-MM-DD verir (gece yarısından hemen önce/sonra)', () => {
    expect(dayKey(at(2026, 9, 28, 23))).toBe('2026-09-28');
    expect(dayKey(at(2026, 9, 29, 0))).toBe('2026-09-29');
  });
});

describe('recordPractice / loadDays', () => {
  it('iki mod aynı günde birleşir, tekrar kayıt değeri bozmaz', () => {
    const storage = memoryStorage();
    recordPractice('off-the-cuff', at(2026, 9, 28), storage);
    recordPractice('off-the-cuff', at(2026, 9, 28), storage);
    expect(loadDays(storage)).toEqual({ '2026-09-28': 1 });
    recordPractice('deep-research', at(2026, 9, 28), storage);
    expect(loadDays(storage)).toEqual({ '2026-09-28': 3 });
  });

  it('bozuk veri ve geçersiz girdiler atılır', () => {
    expect(loadDays(memoryStorage({ 'irticalen:days': '{bozuk' }))).toEqual({});
    expect(loadDays(memoryStorage({ 'irticalen:days': '[1,2]' }))).toEqual({});
    const mixed = JSON.stringify({ '2026-09-28': 2, dun: 1, '2026-09-27': 9, '2026-09-26': 'x' });
    expect(loadDays(memoryStorage({ 'irticalen:days': mixed }))).toEqual({ '2026-09-28': 2 });
  });

  it('depolama yoksa ya da hata verirse fırlatmaz', () => {
    expect(() => recordPractice('off-the-cuff', at(2026, 9, 28), undefined)).not.toThrow();
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadDays(broken)).toEqual({});
    expect(() => recordPractice('off-the-cuff', at(2026, 9, 28), broken)).not.toThrow();
  });
});

describe('currentStreak', () => {
  const log: DayLog = { '2026-09-25': 1, '2026-09-26': 2, '2026-09-27': 3 };

  it('bugün henüz yapılmadıysa zincir dünden sayılır (kırık gösterilmez)', () => {
    expect(currentStreak(log, at(2026, 9, 28))).toBe(3);
    expect(practisedToday(log, at(2026, 9, 28))).toBe(false);
  });

  it('bugün yapıldıysa bugün dahil sayılır', () => {
    expect(currentStreak({ ...log, '2026-09-28': 1 }, at(2026, 9, 28))).toBe(4);
  });

  it('bir gün atlanınca seri sıfırlanır', () => {
    expect(currentStreak(log, at(2026, 9, 29))).toBe(0);
    expect(currentStreak({}, at(2026, 9, 29))).toBe(0);
  });

  it('ay ve yıl sınırını doğru geçer', () => {
    const edge: DayLog = { '2025-12-31': 1, '2026-01-01': 1, '2026-02-28': 1, '2026-03-01': 1 };
    expect(currentStreak(edge, at(2026, 1, 1))).toBe(2);
    expect(currentStreak(edge, at(2026, 3, 1))).toBe(2);
  });
});

describe('longestStreak', () => {
  it('kayıttaki en uzun ardışık günleri bulur', () => {
    const log: DayLog = {
      '2026-09-01': 1,
      '2026-09-02': 1,
      '2026-09-03': 2,
      '2026-09-10': 1,
      '2026-09-30': 1,
      '2026-10-01': 3,
    };
    expect(longestStreak(log)).toBe(3);
    expect(longestStreak({})).toBe(0);
  });
});

describe('buildCalendar', () => {
  it('5 hafta × 7 gün döner, her hafta pazartesi ile başlar', () => {
    // 2026-09-28 bir Pazartesi.
    const weeks = buildCalendar({}, at(2026, 9, 28));
    expect(weeks).toHaveLength(5);
    weeks.forEach((week) => expect(week).toHaveLength(7));
    expect(weeks[4][0].key).toBe('2026-09-28');
    expect(weeks[4][6].key).toBe('2026-10-04');
    // İlk hafta, bugünden 4 hafta (28 gün) önceki pazartesi.
    expect(weeks[0][0].key).toBe('2026-08-31');
  });

  it('bugün haftanın ortasındaysa (Çarşamba) o hafta yine pazartesiyle başlar', () => {
    // 2026-09-30 bir Çarşamba.
    const weeks = buildCalendar({}, at(2026, 9, 30));
    expect(weeks[4][0].key).toBe('2026-09-28'); // pazartesi
    expect(weeks[4][2].key).toBe('2026-09-30'); // bugün, çarşamba
    expect(weeks[4][2].isToday).toBe(true);
  });

  it('ay/yıl sınırını doğru geçer', () => {
    // 2026-01-03 bir Cumartesi; 5 hafta öncesi 2025 Aralık'a düşer.
    const weeks = buildCalendar({}, at(2026, 1, 3));
    expect(weeks[0][0].key).toBe('2025-12-01');
    expect(weeks[4][5].key).toBe('2026-01-03');
  });

  it('bugünden sonraki (bu haftanın kalan) günler işaretsiz ve gelecek olarak işaretlenir', () => {
    const log: DayLog = { '2026-10-04': 3 }; // bugünden sonraki bir gün, veride olsa bile sayılmaz
    const weeks = buildCalendar(log, at(2026, 9, 28)); // pazartesi
    const lastWeek = weeks[4];
    expect(lastWeek[0].isFuture).toBe(false);
    expect(lastWeek[0].isToday).toBe(true);
    for (let i = 1; i < 7; i += 1) {
      expect(lastWeek[i].isFuture).toBe(true);
      expect(lastWeek[i].mark).toBe(0);
    }
  });

  it('bugün pazar ise o hafta gelecek gün içermez', () => {
    // 2026-10-04 bir Pazar.
    const weeks = buildCalendar({}, at(2026, 10, 4));
    const lastWeek = weeks[4];
    expect(lastWeek[6].isToday).toBe(true);
    lastWeek.forEach((day) => expect(day.isFuture).toBe(false));
  });

  it('geçmiş günlerin bitmask değeri log’dan aynen okunur', () => {
    const log: DayLog = { '2026-09-28': 1, '2026-09-29': 3 };
    const weeks = buildCalendar(log, at(2026, 9, 30));
    expect(weeks[4][0].mark).toBe(1);
    expect(weeks[4][1].mark).toBe(3);
    expect(weeks[4][2].mark).toBe(0);
  });
});
