import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../index.js';

const SECRET = 'webhook-secret-123';
const OWNER_CHAT = '424242';

function createDB() {
  const calls: { query: string; bindings: unknown[] }[] = [];
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
          return { success: true, meta: {} };
        },
        async first() {
          calls.push({ query, bindings });
          return null;
        },
      };
    },
  };
}

function setup() {
  const db = createDB();
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException: () => {} };
  const env = {
    DB: db as any,
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_CHAT_ID: OWNER_CHAT,
    TELEGRAM_WEBHOOK_SECRET: SECRET,
  };
  return { db, ctx: ctx as unknown as ExecutionContext, env, pending };
}

function update(body: unknown, secret: string | null = SECRET) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret !== null) headers['X-Telegram-Bot-Api-Secret-Token'] = secret;
  return new Request('https://irticalen.yasinozmeen.me/api/telegram', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const note = (text: string, chat: string | number = Number(OWNER_CHAT)) => ({
  update_id: 77,
  message: { message_id: 5, chat: { id: chat }, text },
});

const inserts = (db: ReturnType<typeof createDB>) => db.calls.filter((c) => c.query.startsWith('INSERT'));

describe('Telegram notes → feedback table', () => {
  let sent: { url: string; body: any }[] = [];
  beforeEach(() => {
    sent = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)) });
      return new Response('{"ok":true}');
    });
  });

  it("stores the owner's message as an idea next to visitors' feedback", async () => {
    const { db, ctx, env } = setup();
    const res = await worker.fetch(update(note('  çarka ses efekti ekle  ')), env, ctx);

    expect(res.status).toBe(200);
    const [insert] = inserts(db);
    expect(insert.query).toContain('INSERT OR IGNORE INTO feedback');
    expect(insert.bindings.slice(1)).toEqual(['idea', 'çarka ses efekti ekle', 'telegram', 'tg:77']);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toContain('/sendMessage');
    expect(sent[0].body).toMatchObject({ chat_id: Number(OWNER_CHAT), text: 'kaydedildi ✓' });
  });

  it('rejects a request without the webhook secret and writes nothing', async () => {
    for (const secret of [null, 'wrong']) {
      const { db, ctx, env } = setup();
      const res = await worker.fetch(update(note('x'), secret), env, ctx);
      expect(res.status).toBe(403);
      expect(db.calls.length).toBe(0);
    }
  });

  it('rejects everything when the Worker has no secret configured', async () => {
    const { db, ctx, env } = setup();
    const res = await worker.fetch(update(note('x'), ''), { ...env, TELEGRAM_WEBHOOK_SECRET: undefined }, ctx);
    expect(res.status).toBe(403);
    expect(db.calls.length).toBe(0);
  });

  it('ignores messages from any other chat', async () => {
    const { db, ctx, env } = setup();
    const res = await worker.fetch(update(note('spam', 999)), env, ctx);
    expect(res.status).toBe(200);
    expect(db.calls.length).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('does not store commands or empty messages', async () => {
    for (const text of ['/start', '   ']) {
      const { db, ctx, env } = setup();
      await worker.fetch(update(note(text)), env, ctx);
      expect(db.calls.length).toBe(0);
    }
  });

  it('only accepts POST', async () => {
    const { ctx, env } = setup();
    const res = await worker.fetch(new Request('https://irticalen.yasinozmeen.me/api/telegram'), env, ctx);
    expect(res.status).toBe(405);
  });
});

describe('owner notes do not use up the visitor quota', () => {
  it('leaves idea rows out of the daily and hourly feedback counts', async () => {
    const queries: string[] = [];
    const db = {
      prepare(query: string) {
        queries.push(query);
        return {
          bind() { return this; },
          async first() { return { count: 0 }; },
          async run() { return { success: true, meta: {} }; },
        };
      },
    };
    const req = new Request('https://irticalen.yasinozmeen.me/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ kind: 'topic', text: 'yeni konu' }),
    });
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
    const res = await worker.fetch(req, { DB: db as any }, ctx);
    expect(res.status).toBe(201);
    const counts = queries.filter((q) => q.startsWith('SELECT COUNT(*)') && !q.includes('ip_hash'));
    expect(counts).toHaveLength(2);
    for (const q of counts) expect(q).toContain("kind != 'idea'");
  });
});
