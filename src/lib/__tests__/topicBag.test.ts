import { describe, expect, it } from 'vitest';
import { drawFromBag, loadSeen, planSpinTo, saveSeen } from '../topicBag';
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
