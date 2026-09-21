import { describe, expect, it } from 'vitest';
import {
  easeOutCubic,
  planSpin,
  positionAt,
  positionFrom,
  randomIndex,
  spinEaseFrom,
  stepAt,
  wheelFaceStep,
  wrapIndex,
} from '../topicPicker';

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

describe('positionAt', () => {
  it('positionAt(0)=0, positionAt(1)=totalSteps, floor consistent with stepAt', () => {
    const totalSteps = 137;
    expect(positionAt(0, totalSteps)).toBe(0);
    expect(positionAt(1, totalSteps)).toBe(totalSteps);

    for (let p = 0; p <= 1; p += 0.02) {
      expect(Math.floor(positionAt(p, totalSteps))).toBe(stepAt(p, totalSteps));
    }
    // stepAt(1) is defined as floor(eased*totalSteps) = totalSteps exactly, matching positionAt(1).
    expect(Math.floor(positionAt(1, totalSteps))).toBe(stepAt(1, totalSteps));
  });

  it('clamps out-of-range progress like easeOutCubic does', () => {
    const totalSteps = 50;
    expect(positionAt(-0.5, totalSteps)).toBe(0);
    expect(positionAt(1.5, totalSteps)).toBe(totalSteps);
  });
});

describe('wheelFaceStep', () => {
  const FACE_COUNT = 12;

  it('position=0: yüz 0 -> 0, yüz 1 -> 1, yüz faceCount-1 -> -1', () => {
    expect(wheelFaceStep(0, FACE_COUNT, 0)).toBe(0);
    expect(wheelFaceStep(1, FACE_COUNT, 0)).toBe(1);
    expect(wheelFaceStep(FACE_COUNT - 1, FACE_COUNT, 0)).toBe(-1);
  });

  it('position=37.4, faceCount=12: tüm n değerleri [position-6, position+6] aralığında ve n mod 12 === faceIndex', () => {
    const position = 37.4;
    for (let face = 0; face < FACE_COUNT; face++) {
      const n = wheelFaceStep(face, FACE_COUNT, position);
      expect(n).toBeGreaterThanOrEqual(position - 6);
      expect(n).toBeLessThanOrEqual(position + 6);
      expect(wrapIndex(n, FACE_COUNT)).toBe(face);
    }
  });

  it('position arttıkça bir yüzün n değeri yalnız yüz arkadayken değişiyor', () => {
    const face = 3;
    let prevN = wheelFaceStep(face, FACE_COUNT, 0);
    for (let position = 0; position <= 24; position += 0.1) {
      const n = wheelFaceStep(face, FACE_COUNT, position);
      if (n !== prevN) {
        // A jump only happens when the face was at (or past) the back of the drum.
        const distanceBeforeJump = Math.abs(prevN - (position - 0.1));
        expect(distanceBeforeJump).toBeGreaterThanOrEqual(FACE_COUNT / 2 - 1);
      }
      prevN = n;
    }
  });
});

describe('spinEaseFrom', () => {
  it('0 -> 0, 1 -> 1, monoton artan', () => {
    expect(spinEaseFrom(0)).toBe(0);
    expect(spinEaseFrom(1)).toBe(1);
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.02) {
      const v = spinEaseFrom(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('aralık dışı progress değerlerini kırpar', () => {
    expect(spinEaseFrom(-0.5)).toBe(0);
    expect(spinEaseFrom(1.5)).toBe(1);
  });
});

describe('positionFrom', () => {
  it('progress=0 -> p0 (sıçrama yok), progress=1 -> target', () => {
    const p0 = 12.37;
    const target = 97;
    expect(positionFrom(p0, target, 0)).toBe(p0);
    expect(positionFrom(p0, target, 1)).toBe(target);
  });

  it('p0 ile target arasında monoton (target > p0 iken)', () => {
    const p0 = 3.2;
    const target = 60;
    let prev = -Infinity;
    for (let t = 0; t <= 1; t += 0.02) {
      const v = positionFrom(p0, target, t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('wrapIndex', () => {
  it('pozitif ve negatif indeksleri doğru sarar', () => {
    expect(wrapIndex(0, 5)).toBe(0);
    expect(wrapIndex(4, 5)).toBe(4);
    expect(wrapIndex(5, 5)).toBe(0);
    expect(wrapIndex(-1, 5)).toBe(4);
    expect(wrapIndex(-5, 5)).toBe(0);
    expect(wrapIndex(-6, 5)).toBe(4);
  });
});
