import { parseEvent, parseFeedback } from './validate.js';
import { feedbackMessage, notifyTelegram, type NotifyEnv } from './notify.js';
import { handleTelegramSetup, handleTelegramUpdate } from './telegram.js';
import { handlePanel } from './panel.js';

export interface Env extends NotifyEnv {
  DB: D1Database;
  IP_SALT?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
}

/**
 * A one-day fingerprint of the sender: SHA-256(ip + secret salt + UTC date), truncated. It cannot be
 * turned back into an IP and does not match the same visitor on another day. The IP itself is never stored.
 */
async function visitorHash(request: Request, env: Env, now: number): Promise<string | null> {
  const ip = request.headers.get('cf-connecting-ip');
  if (!ip || !env.IP_SALT) return null;
  const day = new Date(now).toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${ip}|${env.IP_SALT}|${day}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

const NO_STORE_HEADERS: HeadersInit = {
  'Cache-Control': 'no-store',
};

const JSON_NO_STORE_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

const MAX_EVENT_BYTES = 2048;
const MAX_FEEDBACK_BYTES = 4096;
const FEEDBACK_DAILY_CAP = 1000;
const FEEDBACK_PER_VISITOR_DAILY_CAP = 5;
/** Above this many records in an hour the phone stays quiet; the records are still stored. */
const NOTIFY_HOURLY_CAP = 20;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_ORIGIN = 'https://irticalen.yasinozmeen.me';

/** Browsers always send Origin on POST; a foreign one means another site is posting here. */
function isForeignOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin !== null && origin !== ALLOWED_ORIGIN;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.length > 1 && url.pathname.endsWith('/')
      ? url.pathname.slice(0, -1)
      : url.pathname;
    const method = request.method;

    if (method === 'POST' && isForeignOrigin(request)) {
      return new Response(null, { status: 403, headers: NO_STORE_HEADERS });
    }

    // Route: GET /api/health
    if (pathname === '/api/health') {
      if (method !== 'GET') {
        return new Response(null, {
          status: 405,
          headers: { ...NO_STORE_HEADERS, Allow: 'GET' },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: JSON_NO_STORE_HEADERS,
      });
    }

    // Route: /api/panel — the owner's notebook (Telegram Mini App); every data call checks Telegram's signature
    if (pathname === '/api/panel' || pathname.startsWith('/api/panel/')) {
      return handlePanel(request, env, pathname);
    }

    // Route: POST /api/telegram — the owner's notes from the Telegram bot
    if (pathname === '/api/telegram' || pathname === '/api/telegram/setup') {
      if (method !== 'POST') {
        return new Response(null, {
          status: 405,
          headers: { ...NO_STORE_HEADERS, Allow: 'POST' },
        });
      }
      return pathname === '/api/telegram'
        ? handleTelegramUpdate(request, env, ctx)
        : handleTelegramSetup(request, env);
    }

    // Route: POST /api/e
    if (pathname === '/api/e') {
      if (method !== 'POST') {
        return new Response(null, {
          status: 405,
          headers: { ...NO_STORE_HEADERS, Allow: 'POST' },
        });
      }

      // Check Content-Length first if provided
      const contentLength = request.headers.get('content-length');
      if (contentLength !== null) {
        const parsedLen = parseInt(contentLength, 10);
        if (!Number.isNaN(parsedLen) && parsedLen > MAX_EVENT_BYTES) {
          return new Response(null, { status: 413, headers: NO_STORE_HEADERS });
        }
      }

      // Read text and verify actual byte length
      const text = await request.text();
      const byteLength = new TextEncoder().encode(text).length;
      if (byteLength > MAX_EVENT_BYTES) {
        return new Response(null, { status: 413, headers: NO_STORE_HEADERS });
      }

      // Parse JSON body
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return new Response(null, { status: 400, headers: NO_STORE_HEADERS });
      }

      // Validate event payload
      const result = parseEvent(raw);
      if (!result.ok) {
        return new Response(null, { status: 400, headers: NO_STORE_HEADERS });
      }

      const ev = result.value;
      const ts = Date.now();
      const country = (request as unknown as { cf?: { country?: string } }).cf?.country ?? null;

      try {
        await env.DB.prepare(
          `INSERT INTO events (ts, session, name, locale, mode, category, topic, value, phase, path, device, ref_host, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            ts,
            ev.session,
            ev.name,
            ev.locale,
            ev.mode,
            ev.category,
            ev.topic,
            ev.value,
            ev.phase,
            ev.path,
            ev.device,
            ev.ref_host,
            country
          )
          .run();

        return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
      } catch {
        return new Response(null, { status: 500, headers: NO_STORE_HEADERS });
      }
    }

    // Route: POST /api/feedback
    if (pathname === '/api/feedback') {
      if (method !== 'POST') {
        return new Response(null, {
          status: 405,
          headers: { ...NO_STORE_HEADERS, Allow: 'POST' },
        });
      }

      // Check Content-Length first if provided
      const contentLength = request.headers.get('content-length');
      if (contentLength !== null) {
        const parsedLen = parseInt(contentLength, 10);
        if (!Number.isNaN(parsedLen) && parsedLen > MAX_FEEDBACK_BYTES) {
          return new Response(null, { status: 413, headers: NO_STORE_HEADERS });
        }
      }

      // Read text and verify actual byte length
      const text = await request.text();
      const byteLength = new TextEncoder().encode(text).length;
      if (byteLength > MAX_FEEDBACK_BYTES) {
        return new Response(null, { status: 413, headers: NO_STORE_HEADERS });
      }

      // Parse JSON body
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return new Response(null, { status: 400, headers: NO_STORE_HEADERS });
      }

      // Validate feedback payload
      const result = parseFeedback(raw);
      if (!result.ok) {
        return new Response(null, { status: 400, headers: NO_STORE_HEADERS });
      }

      const fb = result.value;
      const ts = Date.now();
      const country = (request as unknown as { cf?: { country?: string } }).cf?.country ?? null;

      try {
        // Enforce 24h rate limit; the owner's own Telegram notes (kind 'idea') never use up visitors' quota
        const oneDayAgo = ts - ONE_DAY_MS;
        const countRow = await env.DB.prepare(
          `SELECT COUNT(*) AS count FROM feedback WHERE ts >= ? AND kind != 'idea'`
        )
          .bind(oneDayAgo)
          .first<{ count: number }>();

        const currentCount = Number(
          countRow?.count ?? (countRow as Record<string, unknown> | null)?.[Object.keys(countRow ?? {})[0]] ?? 0
        );

        if (currentCount >= FEEDBACK_DAILY_CAP) {
          return new Response(JSON.stringify({ error: 'Daily feedback limit exceeded' }), {
            status: 429,
            headers: JSON_NO_STORE_HEADERS,
          });
        }

        const ipHash = await visitorHash(request, env, ts);
        if (ipHash !== null) {
          const mine = await env.DB.prepare(
            `SELECT COUNT(*) AS count FROM feedback WHERE ts >= ? AND ip_hash = ?`
          )
            .bind(oneDayAgo, ipHash)
            .first<{ count: number }>();
          if (Number(mine?.count ?? 0) >= FEEDBACK_PER_VISITOR_DAILY_CAP) {
            return new Response(JSON.stringify({ error: 'Daily feedback limit exceeded' }), {
              status: 429,
              headers: JSON_NO_STORE_HEADERS,
            });
          }
        }

        const lastHour = await env.DB.prepare(`SELECT COUNT(*) AS count FROM feedback WHERE ts >= ? AND kind != 'idea'`)
          .bind(ts - ONE_HOUR_MS)
          .first<{ count: number }>();
        const quietPhone = Number(lastHour?.count ?? 0) >= NOTIFY_HOURLY_CAP;

        await env.DB.prepare(
          `INSERT INTO feedback (ts, kind, text, contact, locale, path, session, phase, device, country, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            ts,
            fb.kind,
            fb.text,
            fb.contact,
            fb.locale,
            fb.path,
            fb.session,
            fb.phase,
            fb.device,
            country,
            ipHash
          )
          .run();

        // After the response: the visitor never waits for Telegram.
        if (!quietPhone) ctx.waitUntil(notifyTelegram(env, feedbackMessage(fb, country)));

        return new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: JSON_NO_STORE_HEADERS,
        });
      } catch {
        return new Response(null, { status: 500, headers: NO_STORE_HEADERS });
      }
    }

    // Unrecognized routes -> 404
    return new Response(null, { status: 404, headers: NO_STORE_HEADERS });
  },
};
