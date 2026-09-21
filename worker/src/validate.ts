export type EventName =
  | 'page_view'
  | 'spin'
  | 'land'
  | 'start_research'
  | 'research_done'
  | 'start_speech'
  | 'speech_done'
  | 'close_early'
  | 'mode_change'
  | 'category_change'
  | 'settings_open'
  | 'sheet_open'
  | 'share_click'
  | 'feedback_open'
  | 'feedback_sent'
  | 'js_error'
  | 'leave';

export type Locale = 'tr' | 'en';
export type Mode = 'off-the-cuff' | 'deep-research';
export type Phase = 'idle' | 'spinning' | 'research' | 'ready' | 'speech' | 'done';
export type Device = 'mobile' | 'desktop';
export type FeedbackKind = 'topic' | 'problem' | 'other';

export interface ValidatedEvent {
  session: string;
  name: EventName;
  locale: Locale | null;
  mode: Mode | null;
  category: string | null;
  topic: string | null;
  value: number | null;
  phase: Phase | null;
  path: string | null;
  device: Device | null;
  ref_host: string | null;
}

export interface ValidatedFeedback {
  kind: FeedbackKind;
  text: string;
  contact: string | null;
  locale: Locale | null;
  path: string | null;
  session: string | null;
  phase: Phase | null;
  device: Device | null;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false };

const ALLOWED_EVENT_NAMES = new Set<string>([
  'page_view',
  'spin',
  'land',
  'start_research',
  'research_done',
  'start_speech',
  'speech_done',
  'close_early',
  'mode_change',
  'category_change',
  'settings_open',
  'sheet_open',
  'share_click',
  'feedback_open',
  'feedback_sent',
  'js_error',
  'leave',
]);

const ALLOWED_PHASES = new Set<string>([
  'idle',
  'spinning',
  'research',
  'ready',
  'speech',
  'done',
]);

/**
 * Validates and sanitizes raw event payload according to TRACKING.md contract.
 * Discards unknown fields, trims strings, nullifies invalid optional fields,
 * rejects missing or invalid required fields.
 */
export function parseEvent(raw: unknown): ParseResult<ValidatedEvent> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false };
  }

  const record = raw as Record<string, unknown>;

  // Required: s (session: string 8-40)
  if (typeof record.s !== 'string') {
    return { ok: false };
  }
  const session = record.s.trim();
  if (session.length < 8 || session.length > 40) {
    return { ok: false };
  }

  // Required: n (name: allowed event names)
  if (typeof record.n !== 'string') {
    return { ok: false };
  }
  const name = record.n.trim();
  if (!ALLOWED_EVENT_NAMES.has(name)) {
    return { ok: false };
  }

  // Optional: l ('tr' | 'en')
  let locale: Locale | null = null;
  if (typeof record.l === 'string') {
    const l = record.l.trim();
    if (l === 'tr' || l === 'en') {
      locale = l;
    }
  }

  // Optional: m ('off-the-cuff' | 'deep-research')
  let mode: Mode | null = null;
  if (typeof record.m === 'string') {
    const m = record.m.trim();
    if (m === 'off-the-cuff' || m === 'deep-research') {
      mode = m;
    }
  }

  // Optional: c (string <= 40)
  let category: string | null = null;
  if (typeof record.c === 'string') {
    const c = record.c.trim();
    if (c.length > 0 && c.length <= 40) {
      category = c;
    }
  }

  // Optional: t (string <= 200)
  let topic: string | null = null;
  if (typeof record.t === 'string') {
    const t = record.t.trim();
    if (t.length > 0 && t.length <= 200) {
      topic = t;
    }
  }

  // Optional: v (finite number)
  let value: number | null = null;
  if (typeof record.v === 'number' && Number.isFinite(record.v)) {
    value = record.v;
  }

  // Optional: ph ('idle' | 'spinning' | 'research' | 'ready' | 'speech' | 'done', <= 20)
  let phase: Phase | null = null;
  if (typeof record.ph === 'string') {
    const ph = record.ph.trim();
    if (ALLOWED_PHASES.has(ph)) {
      phase = ph as Phase;
    }
  }

  // Optional: p (string <= 80)
  let path: string | null = null;
  if (typeof record.p === 'string') {
    const p = record.p.trim();
    if (p.length > 0 && p.length <= 80) {
      path = p;
    }
  }

  // Optional: d ('mobile' | 'desktop')
  let device: Device | null = null;
  if (typeof record.d === 'string') {
    const d = record.d.trim();
    if (d === 'mobile' || d === 'desktop') {
      device = d;
    }
  }

  // Optional: r (string <= 80)
  let ref_host: string | null = null;
  if (typeof record.r === 'string') {
    const r = record.r.trim();
    if (r.length > 0 && r.length <= 80) {
      ref_host = r;
    }
  }

  return {
    ok: true,
    value: {
      session,
      name: name as EventName,
      locale,
      mode,
      category,
      topic,
      value,
      phase,
      path,
      device,
      ref_host,
    },
  };
}

/**
 * Validates and sanitizes raw feedback payload according to TRACKING.md contract.
 * Discards unknown fields, trims strings, nullifies invalid optional fields,
 * rejects missing or invalid required fields.
 */
export function parseFeedback(raw: unknown): ParseResult<ValidatedFeedback> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false };
  }

  const record = raw as Record<string, unknown>;

  // Required: kind ('topic' | 'problem' | 'other')
  if (typeof record.kind !== 'string') {
    return { ok: false };
  }
  const kind = record.kind.trim();
  if (kind !== 'topic' && kind !== 'problem' && kind !== 'other') {
    return { ok: false };
  }

  // Required: text (string 1-1000)
  if (typeof record.text !== 'string') {
    return { ok: false };
  }
  const text = record.text.trim();
  if (text.length < 1 || text.length > 1000) {
    return { ok: false };
  }

  // Optional: contact (string <= 120)
  let contact: string | null = null;
  if (typeof record.contact === 'string') {
    const c = record.contact.trim();
    if (c.length > 0 && c.length <= 120) {
      contact = c;
    }
  }

  // Optional: l ('tr' | 'en')
  let locale: Locale | null = null;
  if (typeof record.l === 'string') {
    const l = record.l.trim();
    if (l === 'tr' || l === 'en') {
      locale = l;
    }
  }

  // Optional: p (string <= 80)
  let path: string | null = null;
  if (typeof record.p === 'string') {
    const p = record.p.trim();
    if (p.length > 0 && p.length <= 80) {
      path = p;
    }
  }

  // Optional: s (string 8-40)
  let session: string | null = null;
  if (typeof record.s === 'string') {
    const s = record.s.trim();
    if (s.length >= 8 && s.length <= 40) {
      session = s;
    }
  }

  // Optional: ph ('idle' | 'spinning' | 'research' | 'ready' | 'speech' | 'done', <= 20)
  let phase: Phase | null = null;
  if (typeof record.ph === 'string') {
    const ph = record.ph.trim();
    if (ALLOWED_PHASES.has(ph)) {
      phase = ph as Phase;
    }
  }

  // Optional: d ('mobile' | 'desktop')
  let device: Device | null = null;
  if (typeof record.d === 'string') {
    const d = record.d.trim();
    if (d === 'mobile' || d === 'desktop') {
      device = d;
    }
  }

  return {
    ok: true,
    value: {
      kind,
      text,
      contact,
      locale,
      path,
      session,
      phase,
      device,
    },
  };
}
