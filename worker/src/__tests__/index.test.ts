import { describe, it, expect } from 'vitest';
import worker, { Env } from '../index.js';

interface RecordedCall {
  query: string;
  bindings: unknown[];
}

function createMockDB(options?: {
  feedbackCount?: number;
  throwOnEventsRun?: boolean;
  throwOnFeedbackRun?: boolean;
  throwOnFeedbackFirst?: boolean;
}) {
  const calls: RecordedCall[] = [];
  return {
    calls,
    prepare(query: string) {
      let bindings: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          bindings = args;
          return this;
        },
        async run() {
          calls.push({ query, bindings });
          if (query.includes('events') && options?.throwOnEventsRun) {
            throw new Error('D1 events run failure');
          }
          if (query.includes('feedback') && options?.throwOnFeedbackRun) {
            throw new Error('D1 feedback run failure');
          }
          return { success: true, meta: {} };
        },
        async first<T = Record<string, unknown>>() {
          calls.push({ query, bindings });
          if (options?.throwOnFeedbackFirst) {
            throw new Error('D1 feedback first failure');
          }
          return { count: options?.feedbackCount ?? 0 } as T;
        },
      };
    },
  };
}

const mockCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

describe('Worker index.ts', () => {
  it('GET /api/health → 200 {"ok":true} with no-store', async () => {
    const req = new Request('https://irticalen.yasinozmeen.me/api/health', {
      method: 'GET',
    });
    const db = createMockDB();
    const res = await worker.fetch(req, { DB: db as any }, mockCtx);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const data = await res.json();
    expect(data).toEqual({ ok: true });
    expect(db.calls.length).toBe(0);
  });

  it('geçerli olay → 204 ve bind edilen değerler doğru', async () => {
    const payload = {
      s: 'session-track-1234',
      n: 'close_early',
      l: 'tr',
      m: 'off-the-cuff',
      c: 'edebiyat',
      t: 'divan edebiyati',
      v: 24.5,
      ph: 'speech',
      p: '/topic/divan',
      d: 'mobile',
      r: 'yasinozmeen.me',
    };

    const req = new Request('https://irticalen.yasinozmeen.me/api/e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    (req as any).cf = { country: 'TR' };

    const db = createMockDB();
    const res = await worker.fetch(req, { DB: db as any }, mockCtx);

    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(db.calls.length).toBe(1);

    const call = db.calls[0];
    expect(call.query).toContain('INSERT INTO events');

    const [
      ts,
      session,
      name,
      locale,
      mode,
      category,
      topic,
      value,
      phase,
      path,
      device,
      ref_host,
      country,
    ] = call.bindings;

    expect(typeof ts).toBe('number');
    expect(session).toBe('session-track-1234');
    expect(name).toBe('close_early');
    expect(locale).toBe('tr');
    expect(mode).toBe('off-the-cuff');
    expect(category).toBe('edebiyat');
    expect(topic).toBe('divan edebiyati');
    expect(value).toBe(24.5);
    expect(phase).toBe('speech');
    expect(path).toBe('/topic/divan');
    expect(device).toBe('mobile');
    expect(ref_host).toBe('yasinozmeen.me');
    expect(country).toBe('TR');
  });

  it('bilinmeyen olay adı → 400', async () => {
    const req = new Request('https://irticalen.yasinozmeen.me/api/e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ s: 'session-12345', n: 'non_existent_event' }),
    });

    const db = createMockDB();
    const res = await worker.fetch(req, { DB: db as any }, mockCtx);

    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(db.calls.length).toBe(0);
  });

  it('2KB üstü olay → 413 (Content-Length kontrolü)', async () => {
    const req = new Request('https://irticalen.yasinozmeen.me/api/e', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '2049',
      },
      body: JSON.stringify({ s: 'session-12345', n: 'page_view' }),
    });

    const db = createMockDB();
    const res = await worker.fetch(req, { DB: db as any }, mockCtx);

    expect(res.status).toBe(413);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(db.calls.length).toBe(0);
  });

  it('2KB üstü olay → 413 (okunan metin uzunluğu kontrolü)', async () => {
    const largeTopic = 'x'.repeat(2100);
    const bodyStr = JSON.stringify({
      s: 'session-12345',
      n: 'page_view',
      t: largeTopic,
    });

    const req = new Request('https://irticalen.yasinozmeen.me/api/e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
    });

    const db = createMockDB();
    const res = await worker.fetch(req, { DB: db as any }, mockCtx);

    expect(res.status).toBe(413);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(db.calls.length).toBe(0);
  });

  it('text/plain içerik tipiyle gelen JSON kabul edilir', async () => {
    const req = new Request('https://irticalen.yasinozmeen.me/api/e', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ s: 'session-beacon-123', n: 'leave', v: 120 }),
    });

    const db = createMockDB();
    const res = await worker.fetch(req, { DB: db as any }, mockCtx);

    expect(res.status).toBe(204);
    expect(db.calls.length).toBe(1);
    expect(db.calls[0].bindings[1]).toBe('session-beacon-123');
    expect(db.calls[0].bindings[2]).toBe('leave');
    expect(db.calls[0].bindings[7]).toBe(120);
  });

  it('GET /api/e → 405', async () => {
    const req = new Request('https://irticalen.yasinozmeen.me/api/e', {
      method: 'GET',
    });

    const db = createMockDB();
    const res = await worker.fetch(req, { DB: db as any }, mockCtx);

    expect(res.status).toBe(405);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('allow')).toBe('POST');
  });

  it('/api/yok → 404', async () => {
    const req = new Request('https://irticalen.yasinozmeen.me/api/yok', {
      method: 'POST',
    });

    const db = createMockDB();
    const res = await worker.fetch(req, { DB: db as any }, mockCtx);

    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('feedback geçerli → 201', async () => {
    const payload = {
      kind: 'topic',
      text: 'Osmanlı mimarisi hakkında konuşma konusu öneriyorum.',
      contact: 'iletisim@ornek.com',
      l: 'tr',
      p: '/topic/mimari',
      s: 'session-fb-12345',
      ph: 'ready',
      d: 'desktop',
    };

    const req = new Request('https://irticalen.yasinozmeen.me/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    (req as any).cf = { country: 'DE' };

    const db = createMockDB({ feedbackCount: 15 });
    const res = await worker.fetch(req, { DB: db as any }, mockCtx);

    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe('no-store');

    const data = await res.json();
    expect(data).toEqual({ ok: true });

    expect(db.calls.length).toBe(2);
    expect(db.calls[0].query).toContain('SELECT COUNT(*)');
    expect(db.calls[1].query).toContain('INSERT INTO feedback');

    const [
      ts,
      kind,
      text,
      contact,
      locale,
      path,
      session,
      phase,
      device,
      country,
    ] = db.calls[1].bindings;

    expect(typeof ts).toBe('number');
    expect(kind).toBe('topic');
    expect(text).toBe('Osmanlı mimarisi hakkında konuşma konusu öneriyorum.');
    expect(contact).toBe('iletisim@ornek.com');
    expect(locale).toBe('tr');
    expect(path).toBe('/topic/mimari');
    expect(session).toBe('session-fb-12345');
    expect(phase).toBe('ready');
    expect(device).toBe('desktop');
    expect(country).toBe('DE');
  });

  it('boş text → 400', async () => {
    const req = new Request('https://irticalen.yasinozmeen.me/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'problem', text: '   ' }),
    });

    const db = createMockDB();
    const res = await worker.fetch(req, { DB: db as any }, mockCtx);

    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(db.calls.length).toBe(0);
  });

  it('feedback 4KB üstü → 413', async () => {
    const req = new Request('https://irticalen.yasinozmeen.me/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '4097',
      },
      body: JSON.stringify({ kind: 'other', text: 'hello' }),
    });

    const db = createMockDB();
    const res = await worker.fetch(req, { DB: db as any }, mockCtx);

    expect(res.status).toBe(413);
  });

  it('günlük tavan (300 kayıt) → 429', async () => {
    const req = new Request('https://irticalen.yasinozmeen.me/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'topic', text: 'Limit testi' }),
    });

    const db = createMockDB({ feedbackCount: 300 });
    const res = await worker.fetch(req, { DB: db as any }, mockCtx);

    expect(res.status).toBe(429);
    expect(res.headers.get('cache-control')).toBe('no-store');

    // Only count query was executed, no insert occurred
    expect(db.calls.length).toBe(1);
    expect(db.calls[0].query).toContain('SELECT COUNT(*)');
    expect(db.calls.some((c) => c.query.includes('INSERT INTO feedback'))).toBe(false);
  });

  it('IP ve User-Agent bind değerlerinde KESİNLİKLE YER ALMAZ', async () => {
    const sensitiveIp = '198.51.100.89';
    const sensitiveUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 SecretBrowser/99.0';

    // 1. Test on POST /api/e
    const eventReq = new Request('https://irticalen.yasinozmeen.me/api/e', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': sensitiveIp,
        'User-Agent': sensitiveUa,
        'X-Forwarded-For': sensitiveIp,
        'X-Real-IP': sensitiveIp,
      },
      body: JSON.stringify({ s: 'session-privacy-1', n: 'page_view' }),
    });
    (eventReq as any).cf = { country: 'TR' };

    const eventDb = createMockDB();
    const eventRes = await worker.fetch(eventReq, { DB: eventDb as any }, mockCtx);
    expect(eventRes.status).toBe(204);

    // 2. Test on POST /api/feedback
    const feedbackReq = new Request('https://irticalen.yasinozmeen.me/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': sensitiveIp,
        'User-Agent': sensitiveUa,
        'X-Forwarded-For': sensitiveIp,
        'X-Real-IP': sensitiveIp,
      },
      body: JSON.stringify({ kind: 'other', text: 'Gizlilik testi mesaji' }),
    });
    (feedbackReq as any).cf = { country: 'TR' };

    const feedbackDb = createMockDB({ feedbackCount: 1 });
    const feedbackRes = await worker.fetch(feedbackReq, { DB: feedbackDb as any }, mockCtx);
    expect(feedbackRes.status).toBe(201);

    // Verify all bindings across both requests
    const allBindings = [
      ...eventDb.calls.flatMap((c) => c.bindings),
      ...feedbackDb.calls.flatMap((c) => c.bindings),
    ];

    for (const binding of allBindings) {
      const bindingStr = String(binding);
      expect(bindingStr).not.toContain(sensitiveIp);
      expect(bindingStr).not.toContain('198.51.100');
      expect(bindingStr).not.toContain(sensitiveUa);
      expect(bindingStr).not.toContain('SecretBrowser');
      expect(bindingStr).not.toContain('Mozilla');
    }
  });

  it('D1 hatasında olay için 500 döner ve istisna fırlatmaz', async () => {
    const req = new Request('https://irticalen.yasinozmeen.me/api/e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ s: 'session-12345', n: 'page_view' }),
    });

    const db = createMockDB({ throwOnEventsRun: true });
    let threw = false;
    let res: Response | null = null;
    try {
      res = await worker.fetch(req, { DB: db as any }, mockCtx);
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(500);
    expect(res!.headers.get('cache-control')).toBe('no-store');
  });

  it('D1 hatasında feedback için 500 döner ve istisna fırlatmaz', async () => {
    const req = new Request('https://irticalen.yasinozmeen.me/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'problem', text: 'Veritabanı hatası testi' }),
    });

    const db = createMockDB({ throwOnFeedbackRun: true });
    let threw = false;
    let res: Response | null = null;
    try {
      res = await worker.fetch(req, { DB: db as any }, mockCtx);
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(500);
    expect(res!.headers.get('cache-control')).toBe('no-store');
  });

  it('hatalı JSON gövdesi → 400', async () => {
    const req = new Request('https://irticalen.yasinozmeen.me/api/e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not a json',
    });

    const db = createMockDB();
    const res = await worker.fetch(req, { DB: db as any }, mockCtx);

    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('origin gate', () => {
  const body = JSON.stringify({ s: 'session-12345', n: 'page_view' });

  it('rejects a POST from another site with 403 and writes nothing', async () => {
    const db = createMockDB();
    const req = new Request('https://irticalen.yasinozmeen.me/api/e', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
      body,
    });
    const res = await worker.fetch(req, { DB: db } as unknown as Env, mockCtx);
    expect(res.status).toBe(403);
    expect(db.calls).toHaveLength(0);
  });

  it('accepts our own origin and requests without an Origin header', async () => {
    for (const headers of [{ Origin: 'https://irticalen.yasinozmeen.me' }, {}] as Record<string, string>[]) {
      const db = createMockDB();
      const req = new Request('https://irticalen.yasinozmeen.me/api/e', { method: 'POST', headers, body });
      const res = await worker.fetch(req, { DB: db } as unknown as Env, mockCtx);
      expect(res.status).toBe(204);
    }
  });
});
