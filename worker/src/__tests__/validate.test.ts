import { describe, it, expect } from 'vitest';
import { parseEvent, parseFeedback, EventName } from '../validate.js';

describe('validate.ts - parseEvent', () => {
  it('accepts minimal valid event', () => {
    const res = parseEvent({
      s: 'session-12345',
      n: 'page_view',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value).toEqual({
      session: 'session-12345',
      name: 'page_view',
      locale: null,
      mode: null,
      category: null,
      topic: null,
      value: null,
      phase: null,
      path: null,
      device: null,
      ref_host: null,
    });
  });

  it('accepts full valid event with all fields', () => {
    const res = parseEvent({
      s: 'session-valid-token-123',
      n: 'close_early',
      l: 'tr',
      m: 'deep-research',
      c: 'edebiyat',
      t: 'divan edebiyati',
      v: 42.5,
      ph: 'speech',
      p: '/topic/divan',
      d: 'desktop',
      r: 'google.com',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value).toEqual({
      session: 'session-valid-token-123',
      name: 'close_early',
      locale: 'tr',
      mode: 'deep-research',
      category: 'edebiyat',
      topic: 'divan edebiyati',
      value: 42.5,
      phase: 'speech',
      path: '/topic/divan',
      device: 'desktop',
      ref_host: 'google.com',
    });
  });

  it('trims string fields and strips unknown fields', () => {
    const res = parseEvent({
      s: '  session-padded-123  ',
      n: '  spin  ',
      l: '  en  ',
      m: '  off-the-cuff  ',
      c: '  felsefe  ',
      t: '  varolussallik  ',
      v: 10,
      ph: '  spinning  ',
      p: '  /mode/quick  ',
      d: '  mobile  ',
      r: '  twitter.com  ',
      unknown_field_1: 'should_be_stripped',
      extra_payload: { malicious: true },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.session).toBe('session-padded-123');
    expect(res.value.name).toBe('spin');
    expect(res.value.locale).toBe('en');
    expect(res.value.mode).toBe('off-the-cuff');
    expect(res.value.category).toBe('felsefe');
    expect(res.value.topic).toBe('varolussallik');
    expect(res.value.phase).toBe('spinning');
    expect(res.value.path).toBe('/mode/quick');
    expect(res.value.device).toBe('mobile');
    expect(res.value.ref_host).toBe('twitter.com');
    expect((res.value as unknown as Record<string, unknown>).unknown_field_1).toBeUndefined();
    expect((res.value as unknown as Record<string, unknown>).extra_payload).toBeUndefined();
  });

  it('rejects invalid or missing session s', () => {
    expect(parseEvent({ n: 'page_view' }).ok).toBe(false);
    expect(parseEvent({ s: null, n: 'page_view' }).ok).toBe(false);
    expect(parseEvent({ s: 12345678, n: 'page_view' }).ok).toBe(false);
    expect(parseEvent({ s: 'short', n: 'page_view' }).ok).toBe(false); // < 8
    expect(parseEvent({ s: '   seven  ', n: 'page_view' }).ok).toBe(false); // trimmed 'seven' is 5
    expect(parseEvent({ s: 'a'.repeat(41), n: 'page_view' }).ok).toBe(false); // > 40
  });

  it('rejects invalid or unknown event name n', () => {
    expect(parseEvent({ s: 'session-123', n: 'unknown_event_name' }).ok).toBe(false);
    expect(parseEvent({ s: 'session-123', n: '' }).ok).toBe(false);
    expect(parseEvent({ s: 'session-123', n: 123 }).ok).toBe(false);
    expect(parseEvent({ s: 'session-123' }).ok).toBe(false);
  });

  it('accepts all 17 documented event names', () => {
    const validNames: EventName[] = [
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
    ];

    for (const name of validNames) {
      const res = parseEvent({ s: 'session-12345', n: name });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.name).toBe(name);
      }
    }
  });

  it('nullifies invalid optional fields without rejecting the event', () => {
    const res = parseEvent({
      s: 'session-12345',
      n: 'page_view',
      l: 'de', // not 'tr' or 'en'
      m: 'turbo', // not valid mode
      c: 'a'.repeat(41), // exceeds 40
      t: 'b'.repeat(201), // exceeds 200
      v: NaN, // not finite number
      ph: 'non_existent_phase',
      p: 'c'.repeat(81), // exceeds 80
      d: 'tablet', // not mobile/desktop
      r: 'd'.repeat(81), // exceeds 80
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.locale).toBeNull();
    expect(res.value.mode).toBeNull();
    expect(res.value.category).toBeNull();
    expect(res.value.topic).toBeNull();
    expect(res.value.value).toBeNull();
    expect(res.value.phase).toBeNull();
    expect(res.value.path).toBeNull();
    expect(res.value.device).toBeNull();
    expect(res.value.ref_host).toBeNull();
  });

  it('nullifies v if it is Infinity or string or boolean', () => {
    const inf = parseEvent({ s: 'session-12345', n: 'leave', v: Infinity });
    expect(inf.ok && inf.value.value).toBeNull();

    const strNum = parseEvent({ s: 'session-12345', n: 'leave', v: '25' });
    expect(strNum.ok && strNum.value.value).toBeNull();

    const boolVal = parseEvent({ s: 'session-12345', n: 'leave', v: true });
    expect(boolVal.ok && boolVal.value.value).toBeNull();

    const validZero = parseEvent({ s: 'session-12345', n: 'leave', v: 0 });
    expect(validZero.ok && validZero.value.value).toBe(0);
  });

  it('rejects non-object raw payloads', () => {
    expect(parseEvent(null).ok).toBe(false);
    expect(parseEvent(undefined).ok).toBe(false);
    expect(parseEvent('string').ok).toBe(false);
    expect(parseEvent(12345).ok).toBe(false);
    expect(parseEvent([1, 2, 3]).ok).toBe(false);
    expect(parseEvent(true).ok).toBe(false);
  });
});

describe('validate.ts - parseFeedback', () => {
  it('accepts minimal valid feedback', () => {
    const res = parseFeedback({
      kind: 'problem',
      text: 'Ses calismadi',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value).toEqual({
      kind: 'problem',
      text: 'Ses calismadi',
      contact: null,
      locale: null,
      path: null,
      session: null,
      phase: null,
      device: null,
    });
  });

  it('accepts full valid feedback with all fields', () => {
    const res = parseFeedback({
      kind: 'topic',
      text: 'Yapay zeka etiği üzerine bir konu gelsin',
      contact: 'yasin@example.com',
      l: 'tr',
      p: '/topic/ai',
      s: 'session-12345',
      ph: 'ready',
      d: 'mobile',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value).toEqual({
      kind: 'topic',
      text: 'Yapay zeka etiği üzerine bir konu gelsin',
      contact: 'yasin@example.com',
      locale: 'tr',
      path: '/topic/ai',
      session: 'session-12345',
      phase: 'ready',
      device: 'mobile',
    });
  });

  it('trims strings and drops unknown fields', () => {
    const res = parseFeedback({
      kind: '  other  ',
      text: '  Harika bir deneyimdi  ',
      contact: '  test@mail.com  ',
      l: '  en  ',
      p: '  /feedback  ',
      s: '  session-987654  ',
      ph: '  done  ',
      d: '  desktop  ',
      extra_spam: 'drop me',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.kind).toBe('other');
    expect(res.value.text).toBe('Harika bir deneyimdi');
    expect(res.value.contact).toBe('test@mail.com');
    expect(res.value.locale).toBe('en');
    expect(res.value.path).toBe('/feedback');
    expect(res.value.session).toBe('session-987654');
    expect(res.value.phase).toBe('done');
    expect(res.value.device).toBe('desktop');
    expect((res.value as unknown as Record<string, unknown>).extra_spam).toBeUndefined();
  });

  it('rejects invalid or missing kind', () => {
    expect(parseFeedback({ text: 'Valid text' }).ok).toBe(false);
    expect(parseFeedback({ kind: 'bug', text: 'Valid text' }).ok).toBe(false);
    expect(parseFeedback({ kind: '', text: 'Valid text' }).ok).toBe(false);
    expect(parseFeedback({ kind: 123, text: 'Valid text' }).ok).toBe(false);
  });

  it('rejects missing, empty, or whitespace-only text', () => {
    expect(parseFeedback({ kind: 'problem' }).ok).toBe(false);
    expect(parseFeedback({ kind: 'problem', text: '' }).ok).toBe(false);
    expect(parseFeedback({ kind: 'problem', text: '   ' }).ok).toBe(false);
    expect(parseFeedback({ kind: 'problem', text: 12345 }).ok).toBe(false);
  });

  it('rejects text exceeding 1000 characters', () => {
    const longText = 'x'.repeat(1001);
    expect(parseFeedback({ kind: 'problem', text: longText }).ok).toBe(false);

    const exactText = 'x'.repeat(1000);
    expect(parseFeedback({ kind: 'problem', text: exactText }).ok).toBe(true);
  });

  it('nullifies invalid optional feedback fields without rejecting', () => {
    const res = parseFeedback({
      kind: 'topic',
      text: 'Oneri',
      contact: 'c'.repeat(121), // > 120
      l: 'es', // not tr or en
      p: 'p'.repeat(81), // > 80
      s: 'short', // < 8
      ph: 'not_a_phase',
      d: 'smartwatch',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.contact).toBeNull();
    expect(res.value.locale).toBeNull();
    expect(res.value.path).toBeNull();
    expect(res.value.session).toBeNull();
    expect(res.value.phase).toBeNull();
    expect(res.value.device).toBeNull();
  });

  it('rejects non-object raw feedback payloads', () => {
    expect(parseFeedback(null).ok).toBe(false);
    expect(parseFeedback(undefined).ok).toBe(false);
    expect(parseFeedback('just string').ok).toBe(false);
    expect(parseFeedback([1, 2]).ok).toBe(false);
  });
});
