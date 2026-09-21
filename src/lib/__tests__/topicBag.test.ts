import { describe, expect, it } from 'vitest';
import { drawFromBag, loadSeen, planSpinFrom, planSpinTo, saveSeen } from '../topicBag';
import { wrapIndex } from '../topicPicker';
import type { StorageLike } from '../settings';

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

const TOPICS = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('drawFromBag', () => {
  it('goes through every topic once before any topic repeats', () => {
    let seen: string[] = [];
    let current = -1;
    const drawn: string[] = [];
    for (let i = 0; i < TOPICS.length; i += 1) {
      const draw = drawFromBag(TOPICS, seen, current);
      drawn.push(TOPICS[draw.index]);
      seen = draw.seen;
      current = draw.index;
    }
    expect(new Set(drawn).size).toBe(TOPICS.length);
  });

  it('never repeats the topic on screen, even when the bag starts over', () => {
    for (let run = 0; run < 200; run += 1) {
      let seen: string[] = [];
      let current = -1;
      for (let i = 0; i < TOPICS.length * 3; i += 1) {
        const draw = drawFromBag(TOPICS, seen, current);
        expect(draw.index).not.toBe(current);
        seen = draw.seen;
        current = draw.index;
      }
    }
  });

  it('starts over once everything has been seen', () => {
    const draw = drawFromBag(TOPICS, [...TOPICS], 0, () => 0);
    expect(draw.index).toBe(1);
    expect(draw.seen).toEqual(['a', 'b']);
  });

  it('drops seen entries that are no longer in the list', () => {
    const draw = drawFromBag(TOPICS, ['gone', 'a'], -1, () => 0);
    expect(draw.seen).toEqual(['a', 'b']);
  });

  it('never repeats back-to-back in two- and three-topic lists', () => {
    for (const list of [['a', 'b'], ['a', 'b', 'c']]) {
      let seen: string[] = [];
      let current = -1;
      for (let i = 0; i < 40; i += 1) {
        const draw = drawFromBag(list, seen, current);
        expect(draw.index).not.toBe(current);
        seen = draw.seen;
        current = draw.index;
      }
    }
  });

  it('when the only unseen topic is the one on screen, starts over without repeating it', () => {
    const draw = drawFromBag(['a', 'b', 'c'], ['a', 'b'], 2, () => 0);
    expect(draw.index).toBe(0);
    expect(draw.seen).toEqual(['c', 'a']);
  });

  it('throws on an empty list', () => {
    expect(() => drawFromBag([], [], -1)).toThrow();
  });

  it('handles a single-topic list', () => {
    expect(drawFromBag(['only'], [], 0).index).toBe(0);
  });
});

describe('planSpinTo', () => {
  it('lands on the requested index from any start', () => {
    for (let from = -1; from < 6; from += 1) {
      for (let to = 0; to < 6; to += 1) {
        const plan = planSpinTo(from, 6, to);
        const base = from >= 0 ? from : 0;
        expect((base + plan.totalSteps) % 6).toBe(to);
        expect(plan.totalSteps).toBeGreaterThanOrEqual(18);
      }
    }
  });
});

describe('planSpinTo edge cases', () => {
  it('handles one-topic and empty lists, and other list sizes', () => {
    expect(planSpinTo(0, 1, 0)).toEqual({ totalSteps: 0, landIndex: 0 });
    expect(() => planSpinTo(0, 0, 0)).toThrow();
    for (const size of [2, 3, 24]) {
      for (let to = 0; to < size; to += 1) {
        expect((1 + planSpinTo(1, size, to).totalSteps) % size).toBe(to);
      }
    }
  });
});

describe('planSpinFrom', () => {
  it('always lands exactly on landIndex from a fractional p0, at least 3 full turns further', () => {
    const listLength = 6;
    for (let trial = 0; trial < 500; trial += 1) {
      const p0 = Math.random() * 40; // arbitrary drift position, may already be mid-turn
      const startIndex = Math.floor(Math.random() * listLength);
      const landIndex = Math.floor(Math.random() * listLength);
      const plan = planSpinFrom(p0, startIndex, listLength, landIndex, Math.random);
      expect(Number.isInteger(plan.target)).toBe(true);
      expect(wrapIndex(startIndex + plan.target, listLength)).toBe(landIndex);
      expect(plan.target - p0).toBeGreaterThanOrEqual(3 * listLength);
      expect(plan.target).toBeGreaterThan(p0);
    }
  });

  it('p0 = 0 davranışı planSpinTo ile aynı iniş indeksini verir', () => {
    const plan = planSpinFrom(0, 2, 5, 4, () => 0);
    // fullTurns=3, desiredMod = (4-2)%5 = 2, minTarget=15, ceilMin=15, diff=(2-15)%5=2 -> target=17
    expect(plan.target).toBe(17);
    expect((2 + plan.target) % 5).toBe(4);
  });

  it('listLength 1 ise her zaman index 0', () => {
    expect(planSpinFrom(3.5, 0, 1, 0).landIndex).toBe(0);
    expect(planSpinFrom(3.5, 0, 1, 0).target).toBeGreaterThanOrEqual(3.5);
  });

  it('listLength 0 ise hata fırlatır', () => {
    expect(() => planSpinFrom(0, 0, 0, 0)).toThrow();
  });
});

describe('seen storage', () => {
  it('round-trips per locale and category', () => {
    const storage = memoryStorage();
    saveSeen('tr', 'genel', ['a', 'b'], storage);
    expect(loadSeen('tr', 'genel', storage)).toEqual(['a', 'b']);
    expect(loadSeen('en', 'genel', storage)).toEqual([]);
  });

  it('falls back to empty on corrupt data', () => {
    expect(loadSeen('tr', 'genel', memoryStorage({ 'irticalen:seen:tr:genel': '{oops' }))).toEqual([]);
    expect(loadSeen('tr', 'genel', memoryStorage({ 'irticalen:seen:tr:genel': '"x"' }))).toEqual([]);
    expect(loadSeen('tr', 'genel', undefined)).toEqual([]);
  });
});
