import { describe, it, expect } from 'vitest';
import { feedbackMessage, notifyTelegram } from '../notify.js';
import type { ValidatedFeedback } from '../validate.js';

const fb: ValidatedFeedback = {
  kind: 'topic',
  text: 'Yeni konu: *komşuluk* <b>',
  contact: 'a@b.co',
  locale: 'tr',
  path: '/',
  session: null,
  phase: null,
  device: 'mobile',
};

describe('feedbackMessage', () => {
  it('includes kind, text, contact and meta', () => {
    const msg = feedbackMessage(fb, 'TR');
    expect(msg).toContain('konu önerisi');
    expect(msg).toContain('Yeni konu: *komşuluk* <b>');
    expect(msg).toContain('iletişim: a@b.co');
    expect(msg).toContain('tr · mobile · TR · /');
  });

  it('omits the contact line when there is none', () => {
    expect(feedbackMessage({ ...fb, contact: null }, null)).not.toContain('iletişim');
  });
});

describe('notifyTelegram', () => {
  it('does nothing when not configured', async () => {
    let called = false;
    await notifyTelegram({}, 'x', (async () => ((called = true), new Response())) as unknown as typeof fetch);
    expect(called).toBe(false);
  });

  it('posts plain text (no parse_mode) to the configured chat', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response('{}');
    }) as unknown as typeof fetch;
    await notifyTelegram({ TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: '42' }, 'merhaba', fakeFetch);
    expect(calls[0].url).toBe('https://api.telegram.org/botT/sendMessage');
    expect(calls[0].body).toMatchObject({ chat_id: '42', text: 'merhaba' });
    expect(calls[0].body).not.toHaveProperty('parse_mode');
  });

  it('never throws when Telegram is unreachable', async () => {
    const failing = (async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    await expect(notifyTelegram({ TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: '42' }, 'x', failing)).resolves.toBeUndefined();
  });
});
