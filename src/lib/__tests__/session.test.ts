import { describe, expect, it } from 'vitest';
import { initialSession, isLocked, sessionReducer, type SessionState } from '../session';

describe('session: off-the-cuff mutlu yol', () => {
  it('idle -> speech -> done', () => {
    let state = initialSession();
    expect(state.mode).toBe('off-the-cuff');

    state = sessionReducer(state, {
      type: 'SET_CATEGORY',
      categoryId: 'gunluk',
      topicIndex: 2,
      topic: 'Kahve',
    });
    expect(state.categoryId).toBe('gunluk');
    expect(state.topic).toBe('Kahve');

    state = sessionReducer(state, { type: 'START' });
    expect(state.phase).toBe('speech');

    state = sessionReducer(state, { type: 'TIME_UP' });
    expect(state.phase).toBe('done');
  });
});

describe('session: deep-research mutlu yol', () => {
  it('idle -> research -> ready -> speech -> done', () => {
    let state = initialSession();
    state = sessionReducer(state, { type: 'SET_MODE', mode: 'deep-research' });
    expect(state.mode).toBe('deep-research');
    expect(state.categoryId).toBe('deep-research');

    state = sessionReducer(state, { type: 'SPIN_START' });
    state = sessionReducer(state, {
      type: 'SPIN_LAND',
      index: 3,
      topic: 'Yapay zeka etiği',
    });
    expect(state.topic).toBe('Yapay zeka etiği');
    expect(state.spinning).toBe(false);

    state = sessionReducer(state, { type: 'START' });
    expect(state.phase).toBe('research');

    state = sessionReducer(state, { type: 'RESEARCH_DONE' });
    expect(state.phase).toBe('ready');

    state = sessionReducer(state, { type: 'READY_TO_SPEAK' });
    expect(state.phase).toBe('speech');

    state = sessionReducer(state, { type: 'TIME_UP' });
    expect(state.phase).toBe('done');
  });

  it('research fazında TIME_UP ready üretir (süre bitimiyle de tetiklenebilir)', () => {
    let state = initialSession();
    state = sessionReducer(state, { type: 'SET_MODE', mode: 'deep-research' });
    state = sessionReducer(state, { type: 'SPIN_START' });
    state = sessionReducer(state, { type: 'SPIN_LAND', index: 0, topic: 'Konu' });
    state = sessionReducer(state, { type: 'START' });
    expect(state.phase).toBe('research');
    state = sessionReducer(state, { type: 'TIME_UP' });
    expect(state.phase).toBe('ready');
  });
});

describe('session: geçersiz geçişler state referansını değiştirmez', () => {
  function withTopic(): SessionState {
    let state = initialSession();
    state = sessionReducer(state, {
      type: 'SET_CATEGORY',
      categoryId: 'gunluk',
      topicIndex: 0,
      topic: 'Kahve',
    });
    return state;
  }

  it('spinning iken SET_MODE etkisiz', () => {
    let state = withTopic();
    state = sessionReducer(state, { type: 'SPIN_START' });
    const before = state;
    const after = sessionReducer(before, { type: 'SET_MODE', mode: 'deep-research' });
    expect(after).toBe(before);
  });

  it('konu yokken START etkisiz', () => {
    const before = initialSession();
    const after = sessionReducer(before, { type: 'START' });
    expect(after).toBe(before);
  });

  it('oturum açıkken (idle dışı fazda) SPIN_START etkisiz', () => {
    let state = withTopic();
    state = sessionReducer(state, { type: 'START' });
    expect(state.phase).toBe('speech');
    const before = state;
    const after = sessionReducer(before, { type: 'SPIN_START' });
    expect(after).toBe(before);
  });

  it('spinning iken tekrar SPIN_START etkisiz', () => {
    let state = withTopic();
    state = sessionReducer(state, { type: 'SPIN_START' });
    const before = state;
    const after = sessionReducer(before, { type: 'SPIN_START' });
    expect(after).toBe(before);
  });

  it('spinning değilken SPIN_TICK etkisiz', () => {
    const before = withTopic();
    const after = sessionReducer(before, { type: 'SPIN_TICK', index: 5 });
    expect(after).toBe(before);
  });

  it('spinning değilken SPIN_LAND etkisiz', () => {
    const before = withTopic();
    const after = sessionReducer(before, { type: 'SPIN_LAND', index: 5, topic: 'X' });
    expect(after).toBe(before);
  });

  it('deep-research modunda SET_CATEGORY etkisiz', () => {
    let state = initialSession();
    state = sessionReducer(state, { type: 'SET_MODE', mode: 'deep-research' });
    const before = state;
    const after = sessionReducer(before, {
      type: 'SET_CATEGORY',
      categoryId: 'baska',
      topicIndex: 1,
      topic: 'X',
    });
    expect(after).toBe(before);
  });

  it('idle fazda RESEARCH_DONE etkisiz', () => {
    const before = withTopic();
    const after = sessionReducer(before, { type: 'RESEARCH_DONE' });
    expect(after).toBe(before);
  });

  it('idle fazda READY_TO_SPEAK etkisiz', () => {
    const before = withTopic();
    const after = sessionReducer(before, { type: 'READY_TO_SPEAK' });
    expect(after).toBe(before);
  });

  it('speech fazda RESEARCH_DONE etkisiz (yalnız research fazında geçerli)', () => {
    let state = withTopic();
    state = sessionReducer(state, { type: 'START' });
    expect(state.phase).toBe('speech');
    const before = state;
    const after = sessionReducer(before, { type: 'RESEARCH_DONE' });
    expect(after).toBe(before);
  });

  it('idle fazda TIME_UP etkisiz', () => {
    const before = withTopic();
    const after = sessionReducer(before, { type: 'TIME_UP' });
    expect(after).toBe(before);
  });

  it('ready fazda TIME_UP etkisiz (yalnız research/speech tetikler)', () => {
    let state = initialSession();
    state = sessionReducer(state, { type: 'SET_MODE', mode: 'deep-research' });
    state = sessionReducer(state, { type: 'SPIN_START' });
    state = sessionReducer(state, { type: 'SPIN_LAND', index: 0, topic: 'Konu' });
    state = sessionReducer(state, { type: 'START' });
    state = sessionReducer(state, { type: 'RESEARCH_DONE' });
    expect(state.phase).toBe('ready');
    const before = state;
    const after = sessionReducer(before, { type: 'TIME_UP' });
    expect(after).toBe(before);
  });

  it('zaten idle iken CLOSE etkisiz', () => {
    const before = withTopic();
    const after = sessionReducer(before, { type: 'CLOSE' });
    expect(after).toBe(before);
  });
});

describe('session: CLOSE konuyu korur', () => {
  it('speech fazından CLOSE, konuyu ve kategoriyi korur, phase idle olur', () => {
    let state = initialSession();
    state = sessionReducer(state, {
      type: 'SET_CATEGORY',
      categoryId: 'gunluk',
      topicIndex: 1,
      topic: 'Tatil',
    });
    state = sessionReducer(state, { type: 'START' });
    expect(state.phase).toBe('speech');

    state = sessionReducer(state, { type: 'CLOSE' });
    expect(state.phase).toBe('idle');
    expect(state.topic).toBe('Tatil');
    expect(state.categoryId).toBe('gunluk');
    expect(state.spinning).toBe(false);
  });
});

describe('session: isLocked', () => {
  it('spinning ya da idle dışı fazda true', () => {
    const idle = initialSession();
    expect(isLocked(idle)).toBe(false);

    const spinning = sessionReducer(
      sessionReducer(idle, { type: 'SET_CATEGORY', categoryId: 'a', topicIndex: 0, topic: 'X' }),
      { type: 'SPIN_START' },
    );
    expect(isLocked(spinning)).toBe(true);
  });
});
