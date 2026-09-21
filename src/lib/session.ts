import type { Mode, Phase } from './types';

/** Oturum durumu. */
export interface SessionState {
  mode: Mode;
  phase: Phase;
  categoryId: string | null;
  topic: string | null;
  topicIndex: number;
  spinning: boolean;
}

export type SessionAction =
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SET_CATEGORY'; categoryId: string; topicIndex: number; topic: string }
  | { type: 'SPIN_START' }
  | { type: 'SPIN_TICK'; index: number }
  | { type: 'SPIN_LAND'; index: number; topic: string }
  | { type: 'START' }
  | { type: 'RESEARCH_DONE' }
  | { type: 'READY_TO_SPEAK' }
  | { type: 'TIME_UP' }
  | { type: 'CLOSE' };

/** Başlangıç oturumu: hazırlıksız mod, henüz kategori/konu seçilmemiş. */
export function initialSession(): SessionState {
  return {
    mode: 'off-the-cuff',
    phase: 'idle',
    categoryId: null,
    topic: null,
    topicIndex: -1,
    spinning: false,
  };
}

/** Çevirme sürüyor ya da oturum açıksa (idle dışında bir fazdaysa) tüm kontroller kilitlidir. */
export function isLocked(state: SessionState): boolean {
  return state.spinning || state.phase !== 'idle';
}

/** Saf reducer: geçersiz geçişlerde state referansını DEĞİŞTİRMEDEN aynen döndürür. */
export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'SET_MODE': {
      if (isLocked(state)) return state;
      return {
        ...state,
        mode: action.mode,
        categoryId: action.mode === 'deep-research' ? 'deep-research' : null,
        topic: null,
        topicIndex: -1,
      };
    }

    case 'SET_CATEGORY': {
      if (isLocked(state)) return state;
      if (state.mode !== 'off-the-cuff') return state;
      return {
        ...state,
        categoryId: action.categoryId,
        topic: action.topic,
        topicIndex: action.topicIndex,
      };
    }

    case 'SPIN_START': {
      if (isLocked(state)) return state;
      return { ...state, spinning: true };
    }

    case 'SPIN_TICK': {
      if (!state.spinning) return state;
      return { ...state, topicIndex: action.index };
    }

    case 'SPIN_LAND': {
      if (!state.spinning) return state;
      return {
        ...state,
        spinning: false,
        topicIndex: action.index,
        topic: action.topic,
      };
    }

    case 'START': {
      if (state.phase !== 'idle' || state.spinning) return state;
      if (state.topic === null) return state;
      return { ...state, phase: state.mode === 'deep-research' ? 'research' : 'speech' };
    }

    case 'RESEARCH_DONE': {
      if (state.phase !== 'research') return state;
      return { ...state, phase: 'ready' };
    }

    case 'READY_TO_SPEAK': {
      if (state.phase !== 'ready') return state;
      return { ...state, phase: 'speech' };
    }

    case 'TIME_UP': {
      if (state.phase === 'research') return { ...state, phase: 'ready' };
      if (state.phase === 'speech') return { ...state, phase: 'done' };
      return state;
    }

    case 'CLOSE': {
      if (state.phase === 'idle') return state;
      return { ...state, phase: 'idle', spinning: false };
    }

    default:
      return state;
  }
}
