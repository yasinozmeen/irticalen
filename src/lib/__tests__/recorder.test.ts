import { describe, expect, it, vi } from 'vitest';
import {
  VIDEO_MIME_CANDIDATES,
  buildCompositeFileName,
  buildRecordingFileName,
  classifyMediaError,
  downgradeRecordMode,
  isRecordingFeatureAvailable,
  mimeExtension,
  normalizeRecordFormat,
  normalizeRecordMode,
  pickSupportedMimeType,
  recordingPlanForMode,
  revokeObjectUrl,
  stopMediaStream,
  stopRecorderIfActive,
  visibleRecordModes,
  type RecordingCapabilities,
} from '../recorder';

describe('normalizeRecordMode', () => {
  it('bilinen değerleri aynen döner', () => {
    expect(normalizeRecordMode('off')).toBe('off');
    expect(normalizeRecordMode('camera')).toBe('camera');
    expect(normalizeRecordMode('screen')).toBe('screen');
    expect(normalizeRecordMode('both')).toBe('both');
  });

  it('bilinmeyen/eski/bozuk/eksik değer kapalıya düşer', () => {
    expect(normalizeRecordMode('audio')).toBe('off'); // eski (kaldırılan) değer
    expect(normalizeRecordMode('av')).toBe('off'); // eski (kaldırılan) değer
    expect(normalizeRecordMode('evet')).toBe('off');
    expect(normalizeRecordMode(null)).toBe('off');
    expect(normalizeRecordMode(undefined)).toBe('off');
    expect(normalizeRecordMode(1)).toBe('off');
    expect(normalizeRecordMode('')).toBe('off');
  });
});

describe('isRecordingFeatureAvailable', () => {
  it('ikisi de varsa true', () => {
    expect(isRecordingFeatureAvailable(true, true)).toBe(true);
  });

  it('biri eksikse false', () => {
    expect(isRecordingFeatureAvailable(false, true)).toBe(false);
    expect(isRecordingFeatureAvailable(true, false)).toBe(false);
    expect(isRecordingFeatureAvailable(false, false)).toBe(false);
  });
});

describe('visibleRecordModes', () => {
  it('kamera bile yoksa yalnız kapalı görünür', () => {
    expect(visibleRecordModes({ camera: false, screen: false })).toEqual(['off']);
    expect(visibleRecordModes({ camera: false, screen: true })).toEqual(['off']);
  });

  it('kamera var, ekran yoksa: kapalı + kamera', () => {
    expect(visibleRecordModes({ camera: true, screen: false })).toEqual(['off', 'camera']);
  });

  it('ikisi de varsa dört seçenek de görünür', () => {
    expect(visibleRecordModes({ camera: true, screen: true })).toEqual(['off', 'camera', 'screen', 'both']);
  });
});

describe('downgradeRecordMode', () => {
  const both: RecordingCapabilities = { camera: true, screen: true };
  const cameraOnly: RecordingCapabilities = { camera: true, screen: false };
  const none: RecordingCapabilities = { camera: false, screen: false };

  it('off her koşulda off kalır', () => {
    expect(downgradeRecordMode('off', both)).toBe('off');
    expect(downgradeRecordMode('off', none)).toBe('off');
  });

  it('destek tamsa değişmez', () => {
    expect(downgradeRecordMode('camera', both)).toBe('camera');
    expect(downgradeRecordMode('screen', both)).toBe('screen');
    expect(downgradeRecordMode('both', both)).toBe('both');
  });

  it('ekran desteklenmiyorsa screen/both kameraya düşer', () => {
    expect(downgradeRecordMode('screen', cameraOnly)).toBe('camera');
    expect(downgradeRecordMode('both', cameraOnly)).toBe('camera');
    expect(downgradeRecordMode('camera', cameraOnly)).toBe('camera');
  });

  it('kamera da yoksa her şey kapalıya düşer', () => {
    expect(downgradeRecordMode('camera', none)).toBe('off');
    expect(downgradeRecordMode('screen', none)).toBe('off');
    expect(downgradeRecordMode('both', none)).toBe('off');
  });
});

describe('recordingPlanForMode', () => {
  it('off -> null (kayıt yok)', () => {
    expect(recordingPlanForMode('off')).toBeNull();
  });

  it('camera -> tek dosya, kamera+mikrofon', () => {
    expect(recordingPlanForMode('camera')).toEqual({ camera: true, screenOnly: false, combineScreenWithMic: false });
  });

  it('screen -> tek dosya, ekran+mikrofon birleşik', () => {
    expect(recordingPlanForMode('screen')).toEqual({ camera: false, screenOnly: false, combineScreenWithMic: true });
  });

  it('both -> iki ayrı dosya: kamera(+mik) ve yalnız ekran', () => {
    expect(recordingPlanForMode('both')).toEqual({ camera: true, screenOnly: true, combineScreenWithMic: false });
  });
});

describe('pickSupportedMimeType', () => {
  it('sırayla dener, ilk desteklenmeyeni geçer', () => {
    const supported = new Set(['video/webm;codecs=vp9,opus']);
    const type = pickSupportedMimeType(VIDEO_MIME_CANDIDATES, (t) => supported.has(t));
    expect(type).toBe('video/webm;codecs=vp9,opus');
  });

  it('Safari: video/mp4 desteklenince onu (ilk sıradaki) seçer', () => {
    const type = pickSupportedMimeType(VIDEO_MIME_CANDIDATES, () => true);
    expect(type).toBe('video/mp4');
  });

  it('hiçbiri desteklenmiyorsa null döner', () => {
    expect(pickSupportedMimeType(VIDEO_MIME_CANDIDATES, () => false)).toBeNull();
  });

  it('isTypeSupported fırlatırsa o adayı atlayıp devam eder', () => {
    const type = pickSupportedMimeType(VIDEO_MIME_CANDIDATES, (t) => {
      if (t === 'video/mp4') throw new Error('boom');
      return t === 'video/webm';
    });
    expect(type).toBe('video/webm');
  });
});

describe('mimeExtension', () => {
  it('mp4 türlerini .mp4 yapar', () => {
    expect(mimeExtension('video/mp4')).toBe('mp4');
    expect(mimeExtension('audio/mp4')).toBe('mp4');
  });

  it('webm ve bilinmeyenleri .webm yapar', () => {
    expect(mimeExtension('video/webm;codecs=vp9,opus')).toBe('webm');
    expect(mimeExtension('')).toBe('webm');
  });
});

describe('buildRecordingFileName', () => {
  it('tr slug + tarih + kamera varyantı', () => {
    const name = buildRecordingFileName({
      topic: 'Yapay Zeka',
      locale: 'tr',
      mimeType: 'video/webm',
      variant: 'kamera',
      date: new Date(2026, 8, 28),
    });
    expect(name).toBe('irticalen-yapay-zeka-2026-09-28-kamera.webm');
  });

  it('en slug + mp4 uzantısı + ekran varyantı', () => {
    const name = buildRecordingFileName({
      topic: 'Artificial Intelligence',
      locale: 'en',
      mimeType: 'audio/mp4',
      variant: 'ekran',
      date: new Date(2026, 0, 5),
    });
    expect(name).toBe('irticalen-artificial-intelligence-2026-01-05-ekran.mp4');
  });

  it('slug boşa düşerse "konu" yedeğini kullanır', () => {
    const name = buildRecordingFileName({
      topic: '???',
      locale: 'tr',
      mimeType: 'video/webm',
      variant: 'kamera',
      date: new Date(2026, 8, 28),
    });
    expect(name).toBe('irticalen-konu-2026-09-28-kamera.webm');
  });
});

describe('normalizeRecordFormat', () => {
  it('bilinen değerleri aynen döner', () => {
    expect(normalizeRecordFormat('template')).toBe('template');
    expect(normalizeRecordFormat('raw')).toBe('raw');
  });

  it('bilinmeyen/bozuk/eksik değer "template"e düşer', () => {
    expect(normalizeRecordFormat('xx')).toBe('template');
    expect(normalizeRecordFormat(null)).toBe('template');
    expect(normalizeRecordFormat(undefined)).toBe('template');
    expect(normalizeRecordFormat(1)).toBe('template');
  });
});

describe('buildCompositeFileName', () => {
  it('varyant eki olmadan tr slug + tarih', () => {
    const name = buildCompositeFileName({
      topic: 'Yapay Zeka',
      locale: 'tr',
      mimeType: 'video/webm',
      date: new Date(2026, 8, 28),
    });
    expect(name).toBe('irticalen-yapay-zeka-2026-09-28.webm');
  });

  it('en slug + mp4 uzantısı', () => {
    const name = buildCompositeFileName({
      topic: 'Artificial Intelligence',
      locale: 'en',
      mimeType: 'audio/mp4',
      date: new Date(2026, 0, 5),
    });
    expect(name).toBe('irticalen-artificial-intelligence-2026-01-05.mp4');
  });

  it('slug boşa düşerse "konu" yedeğini kullanır', () => {
    const name = buildCompositeFileName({
      topic: '???',
      locale: 'tr',
      mimeType: 'video/webm',
      date: new Date(2026, 8, 28),
    });
    expect(name).toBe('irticalen-konu-2026-09-28.webm');
  });
});

describe('classifyMediaError', () => {
  it('NotAllowedError / SecurityError -> denied', () => {
    expect(classifyMediaError({ name: 'NotAllowedError' })).toBe('denied');
    expect(classifyMediaError({ name: 'SecurityError' })).toBe('denied');
  });

  it('diğer her şey -> unavailable', () => {
    expect(classifyMediaError({ name: 'NotFoundError' })).toBe('unavailable');
    expect(classifyMediaError(new Error('boom'))).toBe('unavailable');
    expect(classifyMediaError(undefined)).toBe('unavailable');
    expect(classifyMediaError('boom')).toBe('unavailable');
  });
});

describe('stopMediaStream', () => {
  it('her track için stop() çağırır', () => {
    const stopA = vi.fn();
    const stopB = vi.fn();
    stopMediaStream({ getTracks: () => [{ stop: stopA }, { stop: stopB }] });
    expect(stopA).toHaveBeenCalledTimes(1);
    expect(stopB).toHaveBeenCalledTimes(1);
  });

  it('null/undefined ile patlamaz', () => {
    expect(() => stopMediaStream(null)).not.toThrow();
    expect(() => stopMediaStream(undefined)).not.toThrow();
  });

  it('bir track fırlatsa bile diğerini durdurur', () => {
    const stopA = vi.fn(() => {
      throw new Error('boom');
    });
    const stopB = vi.fn();
    expect(() => stopMediaStream({ getTracks: () => [{ stop: stopA }, { stop: stopB }] })).not.toThrow();
    expect(stopB).toHaveBeenCalledTimes(1);
  });

  it('getTracks fırlatırsa patlamaz', () => {
    expect(() =>
      stopMediaStream({
        getTracks: () => {
          throw new Error('boom');
        },
      }),
    ).not.toThrow();
  });
});

describe('stopRecorderIfActive', () => {
  it('inactive değilse stop() çağırır', () => {
    const stop = vi.fn();
    stopRecorderIfActive({ state: 'recording', stop });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('zaten inactive ise stop() çağırmaz (çift stop() gerçek tarayıcıda fırlatır)', () => {
    const stop = vi.fn();
    stopRecorderIfActive({ state: 'inactive', stop });
    expect(stop).not.toHaveBeenCalled();
  });

  it('null/undefined ile patlamaz', () => {
    expect(() => stopRecorderIfActive(null)).not.toThrow();
    expect(() => stopRecorderIfActive(undefined)).not.toThrow();
  });

  it('stop() fırlatsa bile patlamaz', () => {
    const stop = vi.fn(() => {
      throw new Error('boom');
    });
    expect(() => stopRecorderIfActive({ state: 'recording', stop })).not.toThrow();
  });
});

describe('revokeObjectUrl', () => {
  it('URL.revokeObjectURL çağırır', () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', { ...URL, revokeObjectURL: revoke });
    revokeObjectUrl('blob:abc');
    expect(revoke).toHaveBeenCalledWith('blob:abc');
    vi.unstubAllGlobals();
  });

  it('null/undefined ile patlamaz ve hiçbir şey çağırmaz', () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', { ...URL, revokeObjectURL: revoke });
    expect(() => revokeObjectUrl(null)).not.toThrow();
    expect(() => revokeObjectUrl(undefined)).not.toThrow();
    expect(revoke).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('fırlayan revokeObjectURL ile patlamaz', () => {
    vi.stubGlobal('URL', {
      ...URL,
      revokeObjectURL: () => {
        throw new Error('boom');
      },
    });
    expect(() => revokeObjectUrl('blob:abc')).not.toThrow();
    vi.unstubAllGlobals();
  });
});
