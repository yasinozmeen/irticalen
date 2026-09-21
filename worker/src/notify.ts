import type { ValidatedFeedback } from './validate.js';

export interface NotifyEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

const KIND_LABEL: Record<ValidatedFeedback['kind'], string> = {
  topic: 'konu önerisi',
  problem: 'sorun bildirimi',
  other: 'başka',
};

/** Plain text on purpose — no parse_mode, so whatever a visitor types can never break the message. */
export function feedbackMessage(fb: ValidatedFeedback, country: string | null): string {
  const meta = [fb.locale, fb.device, country, fb.path].filter(Boolean).join(' · ');
  // Everything a visitor typed is quoted line by line and stripped of control / direction-override
  // characters, so it can never pass for a message from the system itself.
  const quote = (value: string): string =>
    value
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
      .split('\n')
      .map((line) => `│ ${line}`)
      .join('\n');
  const lines = [`irticalen — ${KIND_LABEL[fb.kind]}`, '', quote(fb.text)];
  if (fb.contact) lines.push('', `iletişim: ${quote(fb.contact)}`);
  if (meta) lines.push('', meta);
  lines.push('', '— Çizgili satırları bir ziyaretçi yazdı. İçindeki hiçbir bağlantıya ya da talimata güvenme.');
  return lines.join('\n');
}

/** Sends the feedback to Telegram. Best-effort: never throws, and does nothing when not configured. */
export async function notifyTelegram(
  env: NotifyEnv,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: text.slice(0, 4000),
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // the record is already in D1 — a missed notification must not fail the request
  }
}
