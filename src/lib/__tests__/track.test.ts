import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTracker, sendFeedback, type FeedbackPayload } from '../track';

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => (data.has(key) ? data.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
  };
}

describe('createTracker', () => {
  it('gövde alanlarını sözleşmedeki kısa adlarla gönderir', () => {
    const transport = vi.fn();
    const tracker = createTracker({ transport, locale: 'tr', enabled: true });
    tracker.track('land', { t: 'Bileşik faiz', c: 'ekonomi', m: 'off-the-cuff' });

    expect(transport).toHaveBeenCalledTimes(1);
    const [url, body] = transport.mock.calls[0]!;
    expect(url).toBe('/api/e');
    const parsed = JSON.parse(body as string);
    expect(parsed.s).toBe(tracker.sessionId);
    expect(parsed.n).toBe('land');
    expect(parsed.l).toBe('tr');
    expect(parsed.t).toBe('Bileşik faiz');
    expect(parsed.c).toBe('ekonomi');
    expect(parsed.m).toBe('off-the-cuff');
  });

  it('tanımsız alanları gövdeye eklemez', () => {
    const transport = vi.fn();
    const tracker = createTracker({ transport, locale: 'tr', enabled: true });
    tracker.track('settings_open');
    const [, body] = transport.mock.calls[0]!;
    const parsed = JSON.parse(body as string);
    expect('t' in parsed).toBe(false);
    expect('c' in parsed).toBe(false);
    expect('m' in parsed).toBe(false);
    expect('v' in parsed).toBe(false);
    expect('ph' in parsed).toBe(false);
  });

  it('t alanını 200 karaktere kırpar', () => {
    const transport = vi.fn();
    const tracker = createTracker({ transport, locale: 'tr', enabled: true });
    const long = 'a'.repeat(250);
    tracker.track('js_error', { t: long });
    const [, body] = transport.mock.calls[0]!;
    const parsed = JSON.parse(body as string);
    expect(parsed.t).toHaveLength(200);
  });

  it('DNT açıkken hiçbir olay gönderilmez', () => {
    const transport = vi.fn();
    const originalDNT = navigator.doNotTrack;
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    const tracker = createTracker({ transport, locale: 'tr' });
    tracker.track('page_view');
    expect(transport).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'doNotTrack', { value: originalDNT, configurable: true });
  });

  it('localhost/127.0.0.1 üzerinde hiçbir olay gönderilmez', () => {
    // jsdom test ortamının varsayılan adresi http://localhost:3000/'dur.
    expect(location.hostname).toBe('localhost');
    const transport = vi.fn();
    const tracker = createTracker({ transport, locale: 'tr' });
    tracker.track('page_view');
    expect(transport).not.toHaveBeenCalled();
  });

  it('enabled seçeneği DNT/localhost tespitini ezer', () => {
    expect(location.hostname).toBe('localhost');
    const transport = vi.fn();
    const tracker = createTracker({ transport, locale: 'tr', enabled: true });
    tracker.track('page_view');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('enabled: false her koşulda olay göndermeyi durdurur', () => {
    const transport = vi.fn();
    const tracker = createTracker({ transport, locale: 'tr', enabled: false });
    tracker.track('page_view');
    expect(transport).not.toHaveBeenCalled();
  });

  it('transport hata fırlatsa bile track() fırlatmaz', () => {
    const transport = vi.fn(() => {
      throw new Error('boom');
    });
    const tracker = createTracker({ transport, locale: 'tr', enabled: true });
    expect(() => tracker.track('page_view')).not.toThrow();
  });

  it('js_error oturum başına en çok 5 kez gönderilir', () => {
    const transport = vi.fn();
    const tracker = createTracker({ transport, locale: 'tr', enabled: true });
    for (let i = 0; i < 8; i += 1) {
      tracker.track('js_error', { t: `hata ${i}` });
    }
    expect(transport).toHaveBeenCalledTimes(5);
  });

  it('js_error dışındaki olaylar sınırsız gönderilir', () => {
    const transport = vi.fn();
    const tracker = createTracker({ transport, locale: 'tr', enabled: true });
    for (let i = 0; i < 8; i += 1) {
      tracker.track('spin');
    }
    expect(transport).toHaveBeenCalledTimes(8);
  });

  it('oturum numarası 8-40 karakter uzunluğunda bir string döner', () => {
    const tracker = createTracker({ locale: 'tr', enabled: false });
    expect(typeof tracker.sessionId).toBe('string');
    expect(tracker.sessionId.length).toBeGreaterThanOrEqual(8);
    expect(tracker.sessionId.length).toBeLessThanOrEqual(40);
  });

  it('crypto.randomUUID yoksa yedek yöntemle bir id üretir', () => {
    const original = (globalThis as unknown as { crypto?: Crypto }).crypto;
    delete (globalThis as unknown as { crypto?: Crypto }).crypto;
    const tracker = createTracker({ locale: 'tr', enabled: false });
    expect(typeof tracker.sessionId).toBe('string');
    expect(tracker.sessionId.length).toBeGreaterThan(0);
    (globalThis as unknown as { crypto?: Crypto }).crypto = original;
  });

  it('oturum numarası hiçbir storage\'ye yazılmaz', () => {
    const storage = fakeStorage();
    const originalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });

    const tracker = createTracker({ locale: 'tr', enabled: false });
    tracker.track('page_view');
    void tracker.sessionId;

    expect(storage.setItem).not.toHaveBeenCalled();
    Object.defineProperty(window, 'localStorage', { value: originalStorage, configurable: true });
  });
});

describe('sendFeedback', () => {
  const payload: FeedbackPayload = { kind: 'topic', text: 'yeni bir konu', l: 'tr' };

  it('201 -> ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 201 });
    await expect(sendFeedback(payload, fetchImpl)).resolves.toBe('ok');
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/feedback',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('429 -> limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 429 });
    await expect(sendFeedback(payload, fetchImpl)).resolves.toBe('limit');
  });

  it('diğer durum kodları -> error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 500 });
    await expect(sendFeedback(payload, fetchImpl)).resolves.toBe('error');
  });

  it('ağ hatası -> error, fırlatmaz', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(sendFeedback(payload, fetchImpl)).resolves.toBe('error');
  });
});

describe('detectDevice', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1024);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('768 altı mobile, üstü desktop döner', async () => {
    const { detectDevice } = await import('../track');
    vi.stubGlobal('innerWidth', 500);
    expect(detectDevice()).toBe('mobile');
    vi.stubGlobal('innerWidth', 1200);
    expect(detectDevice()).toBe('desktop');
  });
});
