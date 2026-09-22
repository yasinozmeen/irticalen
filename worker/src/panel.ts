import type { NotifyEnv } from './notify.js';
import { PANEL_HTML } from './panelPage.js';

export interface PanelEnv extends NotifyEnv {
  DB: D1Database;
}

const NO_STORE: HeadersInit = { 'Cache-Control': 'no-store' };
const JSON_NO_STORE: HeadersInit = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
/** Telegram's signed launch data older than this is refused; reopening the panel signs a fresh one. */
const MAX_INIT_AGE_S = 24 * 60 * 60;
const MAX_BODY_BYTES = 8192;
/** Türkiye has no daylight saving: local time is always UTC+3. */
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, encoder.encode(data));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Is this Telegram's signed launch data for the owner? Follows Telegram's Mini App check: the data minus `hash`,
 * sorted as key=value lines, signed with HMAC(HMAC("WebAppData", bot token)). Only the bot token can produce it,
 * so nobody can forge it, and the signed user id must be the owner's (TELEGRAM_CHAT_ID — a private chat's id is
 * the user's id).
 */
export async function isOwner(initData: string, env: NotifyEnv, nowMs = Date.now()): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const owner = env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !owner || !initData) return false;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');
  const checkString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secret = await hmac(encoder.encode('WebAppData') as Uint8Array<ArrayBuffer>, token);
  if (!sameText(toHex(await hmac(secret, checkString)), hash.toLowerCase())) return false;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || nowMs / 1000 - authDate > MAX_INIT_AGE_S) return false;

  try {
    const user = JSON.parse(params.get('user') ?? 'null') as { id?: number } | null;
    return user !== null && String(user.id) === owner;
  } catch {
    return false;
  }
}

type Range = 'today' | '7' | '30' | 'all';

/** Start of the chosen period and of the equally long period before it (null when there is nothing to compare). */
export function periodBounds(range: Range, nowMs: number): { since: number; prevSince: number | null } {
  if (range === 'all') return { since: 0, prevSince: null };
  if (range === 'today') {
    const since = Math.floor((nowMs + TR_OFFSET_MS) / DAY_MS) * DAY_MS - TR_OFFSET_MS;
    return { since, prevSince: since - DAY_MS };
  }
  const days = Number(range);
  return { since: nowMs - days * DAY_MS, prevSince: nowMs - 2 * days * DAY_MS };
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (encoder.encode(text).length > MAX_BODY_BYTES) return null;
  try {
    const raw = JSON.parse(text);
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function panelData(env: PanelEnv, range: Range, nowMs: number) {
  const { since, prevSince } = periodBounds(range, nowMs);
  const fourteenDays = nowMs - 14 * DAY_MS;
  const db = env.DB;
  const [events, prev, early, days, refs, devices, countries, errors, notes] = await db.batch([
    db.prepare(`SELECT name, COUNT(DISTINCT session) AS sessions FROM events WHERE ts >= ? GROUP BY name`).bind(since),
    db.prepare(`SELECT COUNT(DISTINCT session) AS sessions FROM events WHERE name = 'page_view' AND ts >= ? AND ts < ?`)
      .bind(prevSince ?? 0, prevSince === null ? 0 : since),
    db.prepare(`SELECT COUNT(*) AS n, AVG(value) AS avg_left FROM events WHERE name = 'close_early' AND ts >= ?`).bind(since),
    db.prepare(
      `SELECT date((ts + ${TR_OFFSET_MS}) / 1000, 'unixepoch') AS day, COUNT(DISTINCT session) AS sessions
       FROM events WHERE name = 'page_view' AND ts >= ? GROUP BY day ORDER BY day`,
    ).bind(fourteenDays),
    db.prepare(
      `SELECT ref_host AS label, COUNT(DISTINCT session) AS sessions FROM events
       WHERE name = 'page_view' AND ts >= ? GROUP BY ref_host ORDER BY sessions DESC LIMIT 8`,
    ).bind(since),
    db.prepare(
      `SELECT device AS label, COUNT(DISTINCT session) AS sessions FROM events
       WHERE name = 'page_view' AND ts >= ? GROUP BY device ORDER BY sessions DESC`,
    ).bind(since),
    db.prepare(
      `SELECT country AS label, COUNT(DISTINCT session) AS sessions FROM events
       WHERE name = 'page_view' AND ts >= ? GROUP BY country ORDER BY sessions DESC LIMIT 8`,
    ).bind(since),
    db.prepare(
      `SELECT topic AS label, COUNT(*) AS n FROM events WHERE name = 'js_error' AND ts >= ?
       GROUP BY topic ORDER BY n DESC LIMIT 5`,
    ).bind(since),
    db.prepare(
      `SELECT id, ts, kind, text, contact, device, country, done_at FROM feedback
       WHERE hidden_at IS NULL ORDER BY ts DESC LIMIT 200`,
    ),
  ]);

  const eventSessions: Record<string, number> = {};
  for (const row of events.results as { name: string; sessions: number }[]) eventSessions[row.name] = row.sessions;
  const earlyRow = (early.results[0] ?? {}) as { n?: number; avg_left?: number | null };

  return {
    range,
    now: nowMs,
    events: eventSessions,
    previousVisitors: prevSince === null ? null : Number((prev.results[0] as { sessions?: number })?.sessions ?? 0),
    closeEarly: { count: Number(earlyRow.n ?? 0), avgLeft: earlyRow.avg_left ?? null },
    days: days.results,
    refs: refs.results,
    devices: devices.results,
    countries: countries.results,
    errors: errors.results,
    notes: notes.results,
  };
}

const NOTE_ACTIONS: Record<string, (now: number) => { sql: string; stamp: number[] }> = {
  done: (now) => ({ sql: `UPDATE feedback SET done_at = ? WHERE id = ?`, stamp: [now] }),
  undone: () => ({ sql: `UPDATE feedback SET done_at = NULL WHERE id = ?`, stamp: [] }),
  hide: (now) => ({ sql: `UPDATE feedback SET hidden_at = ? WHERE id = ?`, stamp: [now] }),
  unhide: () => ({ sql: `UPDATE feedback SET hidden_at = NULL WHERE id = ?`, stamp: [] }),
};

/**
 * /api/panel — the owner's notebook, opened as a Telegram Mini App.
 * GET  /api/panel       the page itself (holds no data)
 * POST /api/panel/data  { init, range } → numbers and messages
 * POST /api/panel/note  { init, id, action } → mark done / hide (hidden rows stay in the table)
 */
export async function handlePanel(request: Request, env: PanelEnv, pathname: string): Promise<Response> {
  if (pathname === '/api/panel') {
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: { ...NO_STORE, Allow: 'GET' } });
    return new Response(PANEL_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', ...NO_STORE } });
  }

  if (pathname !== '/api/panel/data' && pathname !== '/api/panel/note') {
    return new Response(null, { status: 404, headers: NO_STORE });
  }
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...NO_STORE, Allow: 'POST' } });

  const body = await readBody(request);
  if (!body) return new Response(null, { status: 400, headers: NO_STORE });
  if (!(await isOwner(String(body.init ?? ''), env))) return new Response(null, { status: 403, headers: NO_STORE });

  try {
    if (pathname === '/api/panel/data') {
      const range = (['today', '7', '30', 'all'] as const).find((r) => r === body.range) ?? '7';
      return new Response(JSON.stringify(await panelData(env, range, Date.now())), { headers: JSON_NO_STORE });
    }

    const id = Number(body.id);
    const action = String(body.action);
    if (!Number.isInteger(id) || id <= 0 || !Object.hasOwn(NOTE_ACTIONS, action)) {
      return new Response(null, { status: 400, headers: NO_STORE });
    }
    const { sql, stamp } = NOTE_ACTIONS[action](Date.now());
    await env.DB.prepare(sql).bind(...stamp, id).run();
    return new Response(JSON.stringify({ ok: true }), { headers: JSON_NO_STORE });
  } catch {
    return new Response(null, { status: 500, headers: NO_STORE });
  }
}
