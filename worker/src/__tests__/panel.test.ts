import { describe, it, expect } from 'vitest';
// @ts-ignore -- the Worker has no Node types; vitest runs on Node, where this import exists
import { createHmac } from 'node:crypto';
import worker from '../index.js';
import { periodBounds } from '../panel.js';

const TOKEN = '123456:test-bot-token';
const OWNER = '424242';
const ORIGIN = 'https://irticalen.yasinozmeen.me';

/** Signs launch data exactly as Telegram's docs describe, independently of the Worker's code. */
function signedInit(fields: Record<string, string>, token = TOKEN): string {
  const check = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const now = () => String(Math.floor(Date.now() / 1000));
const ownerInit = () => signedInit({ auth_date: now(), query_id: 'q1', user: JSON.stringify({ id: Number(OWNER), first_name: 'Y' }) });

function createDB() {
  const calls: { query: string; bindings: unknown[] }[] = [];
  const stmt = (query: string) => {
    const s = {
      query,
      bindings: [] as unknown[],
      bind(...args: unknown[]) {
        s.bindings = args;
        return s;
      },
      async run() {
        calls.push({ query, bindings: s.bindings });
        return { success: true, meta: {} };
      },
    };
    return s;
  };
  return {
    calls,
    prepare: stmt,
    async batch(list: ReturnType<typeof stmt>[]) {
      for (const s of list) calls.push({ query: s.query, bindings: s.bindings });
      return list.map((s) => ({
        results: s.query.includes('GROUP BY name')
          ? [{ name: 'page_view', sessions: 5 }]
          : s.query.includes('FROM feedback')
            ? [{ id: 1, ts: 1, kind: 'idea', text: 'fikir', done_at: null }]
            : [],
      }));
    },
  };
}

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
const env = (db = createDB()) => ({ DB: db as any, TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: OWNER });

const post = (path: string, body: unknown) =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(body),
  });

describe('notebook access', () => {
  it('gives the owner the numbers and messages', async () => {
    const db = createDB();
    const res = await worker.fetch(post('/api/panel/data', { init: ownerInit(), range: '7' }), env(db), ctx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.events.page_view).toBe(5);
    expect(data.notes[0].text).toBe('fikir');
  });

  it('refuses launch data signed for someone else', async () => {
    const init = signedInit({ auth_date: now(), user: JSON.stringify({ id: 999 }) });
    const res = await worker.fetch(post('/api/panel/data', { init }), env(), ctx);
    expect(res.status).toBe(403);
  });

  it('refuses the owner id written into data that was signed for someone else', async () => {
    const tampered = new URLSearchParams(signedInit({ auth_date: now(), user: JSON.stringify({ id: 999 }) }));
    tampered.set('user', JSON.stringify({ id: Number(OWNER) }));
    const db = createDB();
    const res = await worker.fetch(post('/api/panel/data', { init: tampered.toString() }), env(db), ctx);
    expect(res.status).toBe(403);
    expect(db.calls).toHaveLength(0);
  });

  it('refuses data signed with another bot token', async () => {
    const init = signedInit({ auth_date: now(), user: JSON.stringify({ id: Number(OWNER) }) }, '999:other');
    const res = await worker.fetch(post('/api/panel/data', { init }), env(), ctx);
    expect(res.status).toBe(403);
  });

  it('refuses launch data older than a day', async () => {
    const old = String(Math.floor(Date.now() / 1000) - 25 * 3600);
    const init = signedInit({ auth_date: old, user: JSON.stringify({ id: Number(OWNER) }) });
    const res = await worker.fetch(post('/api/panel/data', { init }), env(), ctx);
    expect(res.status).toBe(403);
  });

  it('refuses everything without launch data or without a bot token', async () => {
    expect((await worker.fetch(post('/api/panel/data', {}), env(), ctx)).status).toBe(403);
    const noToken = { ...env(), TELEGRAM_BOT_TOKEN: undefined };
    expect((await worker.fetch(post('/api/panel/data', { init: ownerInit() }), noToken, ctx)).status).toBe(403);
  });

  it('serves the page itself without any data in it', async () => {
    const db = createDB();
    const res = await worker.fetch(new Request(`${ORIGIN}/api/panel`), env(db), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(db.calls).toHaveLength(0);
  });
});

describe('notebook actions', () => {
  it('marks a message done with a timestamp', async () => {
    const db = createDB();
    const res = await worker.fetch(post('/api/panel/note', { init: ownerInit(), id: 7, action: 'done' }), env(db), ctx);
    expect(res.status).toBe(200);
    expect(db.calls[0].query).toBe('UPDATE feedback SET done_at = ? WHERE id = ?');
    expect(db.calls[0].bindings[1]).toBe(7);
  });

  it('"sil" only hides the row; nothing is ever deleted', async () => {
    for (const action of ['hide', 'unhide', 'undone']) {
      const db = createDB();
      await worker.fetch(post('/api/panel/note', { init: ownerInit(), id: 3, action }), env(db), ctx);
      expect(db.calls[0].query).toMatch(/^UPDATE feedback SET/);
      expect(db.calls[0].bindings.at(-1)).toBe(3);
    }
  });

  it('rejects unknown actions and bad ids', async () => {
    for (const body of [
      { action: 'delete', id: 1 },
      { action: '__proto__', id: 1 },
      { action: 'done', id: 'x' },
      { action: 'done', id: -1 },
    ]) {
      const db = createDB();
      const res = await worker.fetch(post('/api/panel/note', { init: ownerInit(), ...body }), env(db), ctx);
      expect(res.status).toBe(400);
      expect(db.calls).toHaveLength(0);
    }
  });

  it('checks the signature before touching anything', async () => {
    const db = createDB();
    const res = await worker.fetch(post('/api/panel/note', { init: 'hash=abc', id: 1, action: 'hide' }), env(db), ctx);
    expect(res.status).toBe(403);
    expect(db.calls).toHaveLength(0);
  });
});

describe('periods', () => {
  it('starts "today" at midnight Türkiye time', () => {
    // 2026-09-22 01:30 in Istanbul = 2026-09-21 22:30 UTC
    const nowMs = Date.UTC(2026, 8, 21, 22, 30);
    const { since, prevSince } = periodBounds('today', nowMs);
    expect(since).toBe(Date.UTC(2026, 8, 21, 21, 0));
    expect(prevSince).toBe(Date.UTC(2026, 8, 20, 21, 0));
  });

  it('has nothing to compare for "all"', () => {
    expect(periodBounds('all', Date.now())).toEqual({ since: 0, prevSince: null });
  });
});
