import type { NotifyEnv } from './notify.js';

export interface TelegramEnv extends NotifyEnv {
  DB: D1Database;
  /** Telegram echoes it in X-Telegram-Bot-Api-Secret-Token; without it nobody else can post as the bot. */
  TELEGRAM_WEBHOOK_SECRET?: string;
}

const WEBHOOK_URL = 'https://irticalen.yasinozmeen.me/api/telegram';
const PANEL_URL = 'https://irticalen.yasinozmeen.me/api/panel';
const OPEN_PANEL = { inline_keyboard: [[{ text: 'defteri aç', web_app: { url: PANEL_URL } }]] };
const MAX_NOTE_CHARS = 4000;

const NO_STORE: HeadersInit = { 'Cache-Control': 'no-store' };

function hasSecret(request: Request, env: TelegramEnv): boolean {
  const given = request.headers.get('x-telegram-bot-api-secret-token');
  return Boolean(env.TELEGRAM_WEBHOOK_SECRET) && given === env.TELEGRAM_WEBHOOK_SECRET;
}

async function callTelegram(
  env: TelegramEnv,
  method: string,
  body: unknown,
  fetchImpl: typeof fetch,
): Promise<Response> {
  return fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

interface TelegramMessage {
  message_id?: number;
  chat?: { id?: number | string };
  text?: string;
  caption?: string;
}

/**
 * POST /api/telegram — the owner's own notes. Only messages from TELEGRAM_CHAT_ID (the owner's chat
 * with the bot) are stored, in the same `feedback` table as visitors' messages, with kind = 'idea'.
 * Always answers 200 once the secret matches, so Telegram does not keep retrying ignored updates.
 */
export async function handleTelegramUpdate(
  request: Request,
  env: TelegramEnv,
  ctx: ExecutionContext,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (!hasSecret(request, env)) return new Response(null, { status: 403, headers: NO_STORE });

  let update: { update_id?: number; message?: TelegramMessage };
  try {
    update = await request.json();
  } catch {
    return new Response(null, { status: 200, headers: NO_STORE });
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  if (!msg || chatId === undefined || String(chatId) !== env.TELEGRAM_CHAT_ID?.trim()) {
    return new Response(null, { status: 200, headers: NO_STORE });
  }

  const reply = (text: string, extra: Record<string, unknown> = {}) =>
    ctx.waitUntil(
      callTelegram(env, 'sendMessage', { chat_id: chatId, text, reply_to_message_id: msg.message_id, ...extra }, fetchImpl)
        .then(() => undefined)
        .catch(() => undefined),
    );

  const text = (msg.text ?? msg.caption ?? '').trim();
  if (!text) {
    reply('Yalnız yazı kaydedilir.');
    return new Response(null, { status: 200, headers: NO_STORE });
  }
  if (text.startsWith('/')) {
    reply('Buraya yazdığın her mesaj irticalen için fikir olarak kaydedilir. Sayılar ve mesajlar defterde:', {
      reply_markup: OPEN_PANEL,
    });
    return new Response(null, { status: 200, headers: NO_STORE });
  }

  // Telegram re-sends an update it thinks failed; the update id keeps a note from being stored twice.
  const dedupeKey = `tg:${update.update_id ?? msg.message_id}`;
  // The unique index idx_feedback_idea_session turns a concurrent retry into a no-op.
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO feedback (ts, kind, text, path, session) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(Date.now(), 'idea', text.slice(0, MAX_NOTE_CHARS), 'telegram', dedupeKey)
      .run();
  } catch {
    // 500 → Telegram tries again later; the dedupe key makes the retry safe
    return new Response(null, { status: 500, headers: NO_STORE });
  }

  reply('kaydedildi ✓');
  return new Response(null, { status: 200, headers: NO_STORE });
}

/**
 * POST /api/telegram/setup — points the bot's webhook here and puts the notebook button in the owner's chat. Guarded by the same secret, so the bot token
 * never has to leave the Worker. Safe to call again.
 */
export async function handleTelegramSetup(
  request: Request,
  env: TelegramEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (!hasSecret(request, env) || !env.TELEGRAM_BOT_TOKEN) {
    return new Response(null, { status: 403, headers: NO_STORE });
  }
  const res = await callTelegram(
    env,
    'setWebhook',
    { url: WEBHOOK_URL, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message'] },
    fetchImpl,
  );
  // The "defter" button next to the message box — set only in the owner's chat, nobody else sees it.
  const menu = await callTelegram(
    env,
    'setChatMenuButton',
    { chat_id: env.TELEGRAM_CHAT_ID?.trim(), menu_button: { type: 'web_app', text: 'defter', web_app: { url: PANEL_URL } } },
    fetchImpl,
  );
  const ok = res.ok && menu.ok;
  return new Response(JSON.stringify({ webhook: await res.json(), menu: await menu.json() }), {
    status: ok ? 200 : 502,
    headers: { 'Content-Type': 'application/json', ...NO_STORE },
  });
}
