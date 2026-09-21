import { describe, expect, it } from 'vitest';
import { easeOutCubic, planSpin, randomIndex, stepAt } from '../topicPicker';

describe('planSpin', () => {
  it('10.000 rastgele denemede landIndex hiçbir zaman currentIndex olmaz (listLength >= 2)', () => {
    const listLength = 7;
    for (let i = 0; i < 10000; i++) {
      const currentIndex = Math.floor(Math.random() * listLength);
      const { landIndex } = planSpin(currentIndex, listLength, Math.random);
      expect(landIndex).not.toBe(currentIndex);
      expect(landIndex).toBeGreaterThanOrEqual(0);
      expect(landIndex).toBeLessThan(listLength);
    }
  });

  it('sınır rng değeri 0 ile offset [1, n-1] aralığında olur', () => {
    const listLength = 5;
    const currentIndex = 2;
    const plan = planSpin(currentIndex, listLength, () => 0);
    // fullTurns = 3, offset = 1
    expect(plan.totalSteps).toBe(3 * listLength + 1);
    expect(plan.landIndex).toBe((currentIndex + 1) % listLength);
    expect(plan.landIndex).not.toBe(currentIndex);
  });

  it('sınır rng değeri 0.999999 ile offset [1, n-1] aralığında olur', () => {
    const listLength = 5;
    const currentIndex = 2;
    const plan = planSpin(currentIndex, listLength, () => 0.999999);
    // fullTurns = floor(3 + 0.999999*3) = 5, offset = floor(1 + 0.999999*4) = 4
    expect(plan.totalSteps).toBe(5 * listLength + 4);
    expect(plan.landIndex).toBe((currentIndex + 4) % listLength);
    expect(plan.landIndex).not.toBe(currentIndex);
  });

  it('listLength 1 ise landIndex her zaman 0', () => {
    const plan = planSpin(0, 1, () => 0.5);
    expect(plan.landIndex).toBe(0);
  });

  it('listLength 0 ise hata fırlatır', () => {
    expect(() => planSpin(0, 0, () => 0.5)).toThrow();
  });

  it('currentIndex -1 (henüz konu yok) durumunda her indekse inebilir', () => {
    const listLength = 4;
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const { landIndex } = planSpin(-1, listLength, Math.random);
      expect(landIndex).toBeGreaterThanOrEqual(0);
      expect(landIndex).toBeLessThan(listLength);
      seen.add(landIndex);
    }
    expect(seen.size).toBe(listLength);
  });
});

describe('randomIndex', () => {
  it('[0, listLength) aralığında döner', () => {
    for (let i = 0; i < 1000; i++) {
      const idx = randomIndex(6, Math.random);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(6);
      expect(Number.isInteger(idx)).toBe(true);
    }
  });

  it('rng=0 -> 0, rng=0.999999 -> son indeks', () => {
    expect(randomIndex(5, () => 0)).toBe(0);
    expect(randomIndex(5, () => 0.999999)).toBe(4);
  });
});

describe('easeOutCubic', () => {
  it('0 -> 0, 1 -> 1, monoton artan', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('stepAt', () => {
  it('monoton artan, stepAt(0)=0, stepAt(1)=totalSteps', () => {
    const totalSteps = 137;
    expect(stepAt(0, totalSteps)).toBe(0);
    expect(stepAt(1, totalSteps)).toBe(totalSteps);

    let prev = -1;
    for (let p = 0; p <= 1; p += 0.02) {
      const v = stepAt(p, totalSteps);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});
