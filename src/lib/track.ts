import type { Locale } from './types';

/** Event names accepted by `POST /api/e` (see docs/TRACKING.md). */
export type TrackEventName =
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

/** Optional per-event fields (short names match docs/TRACKING.md exactly). */
export interface TrackProps {
  /** Mode: `off-the-cuff` | `deep-research`. */
  m?: 'off-the-cuff' | 'deep-research';
  /** Category id. */
  c?: string;
  /** Topic, or an error message (truncated to 200 chars). */
  t?: string;
  /** Numeric value (seconds). */
  v?: number;
  /** Current phase. */
  ph?: 'idle' | 'spinning' | 'research' | 'ready' | 'speech' | 'done';
}

export interface CreateTrackerOptions {
  /** Injectable transport (defaults to sendBeacon, falling back to fetch). Never throws. */
  transport?: (url: string, body: string) => void;
  locale: Locale;
  /** Overrides the DNT/localhost auto-detection (for tests). */
  enabled?: boolean;
  /** Injectable clock (for tests). */
  now?: () => number;
}

export interface Tracker {
  track(name: TrackEventName, props?: TrackProps): void;
  /** In-memory session id — never written to storage. */
  sessionId: string;
}

const EVENT_ENDPOINT = '/api/e';
const MAX_JS_ERRORS_PER_SESSION = 5;

function randomFallbackId(): string {
  const part = (): string => Math.random().toString(36).slice(2);
  return `${part()}${part()}${part()}`;
}

function generateSessionId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // ignore, fall through to the fallback below
  }
  return randomFallbackId();
}

/** `mobile` when the viewport is narrower than 768px, `desktop` otherwise; undefined if unknown. */
export function detectDevice(): 'mobile' | 'desktop' | undefined {
  try {
    if (typeof innerWidth !== 'number') return undefined;
    return innerWidth < 768 ? 'mobile' : 'desktop';
  } catch {
    return undefined;
  }
}

/** Referring host, only when it is a different site (own-domain referrers are dropped). */
function detectReferrerHost(): string | undefined {
  try {
    const ref = typeof document !== 'undefined' ? document.referrer : '';
    if (!ref) return undefined;
    const refUrl = new URL(ref);
    if (typeof location !== 'undefined' && refUrl.hostname === location.hostname) return undefined;
    return refUrl.hostname.slice(0, 80);
  } catch {
    return undefined;
  }
}

function detectPath(): string | undefined {
  try {
    return typeof location !== 'undefined' ? location.pathname.slice(0, 80) : undefined;
  } catch {
    return undefined;
  }
}

function autoEnabled(): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') return false;
  } catch {
    // ignore
  }
  try {
    if (typeof location !== 'undefined') {
      const host = location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') return false;
    }
  } catch {
    // ignore
  }
  return true;
}

function defaultTransport(url: string, body: string): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(url, body);
      if (sent) return;
    }
  } catch {
    // fall through to fetch
  }
  try {
    if (typeof fetch === 'function') {
      void fetch(url, { method: 'POST', body, keepalive: true }).catch(() => {
        // swallow — events are best-effort
      });
    }
  } catch {
    // never throw
  }
}

/** Creates a tracker with its own in-memory session id. Never throws. */
export function createTracker(options: CreateTrackerOptions): Tracker {
  const { transport = defaultTransport, locale, enabled } = options;
  const sessionId = generateSessionId();
  const isEnabled = enabled ?? autoEnabled();
  let jsErrorCount = 0;

  return {
    sessionId,
    track(name: TrackEventName, props: TrackProps = {}): void {
      if (!isEnabled) return;
      if (name === 'js_error') {
        if (jsErrorCount >= MAX_JS_ERRORS_PER_SESSION) return;
        jsErrorCount += 1;
      }
      try {
        const body: Record<string, unknown> = {
          s: sessionId,
          n: name,
          l: locale,
        };
        if (props.m !== undefined) body.m = props.m;
        if (props.c !== undefined) body.c = props.c;
        if (props.t !== undefined) body.t = props.t.slice(0, 200);
        if (props.v !== undefined) body.v = props.v;
        if (props.ph !== undefined) body.ph = props.ph;
        const device = detectDevice();
        if (device !== undefined) body.d = device;
        const path = detectPath();
        if (path !== undefined) body.p = path;
        const referrer = detectReferrerHost();
        if (referrer !== undefined) body.r = referrer;
        transport(EVENT_ENDPOINT, JSON.stringify(body));
      } catch {
        // tracking must never throw
      }
    },
  };
}

declare global {
  interface Window {
    __irticalenTracker?: Tracker;
  }
}

/**
 * Module-level singleton so both islands (App, Dock) share one session id.
 * Falls back to a disabled, throwaway tracker outside the browser (SSR).
 */
export function getTracker(locale: Locale): Tracker {
  try {
    if (typeof window !== 'undefined') {
      if (!window.__irticalenTracker) {
        window.__irticalenTracker = createTracker({ locale });
      }
      return window.__irticalenTracker;
    }
  } catch {
    // fall through
  }
  return createTracker({ locale, enabled: false });
}

export type FeedbackKind = 'topic' | 'problem' | 'other';
export type FeedbackResult = 'ok' | 'limit' | 'error';

export interface FeedbackPayload {
  kind: FeedbackKind;
  text: string;
  contact?: string;
  l: Locale;
  p?: string;
  s?: string;
  ph?: string;
  d?: 'mobile' | 'desktop';
}

/** POSTs a feedback/topic-suggestion payload. Never throws — 'error' covers network failures too. */
export async function sendFeedback(
  payload: FeedbackPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<FeedbackResult> {
  try {
    const response = await fetchImpl('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.status === 201) return 'ok';
    if (response.status === 429) return 'limit';
    return 'error';
  } catch {
    return 'error';
  }
}
