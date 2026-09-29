/**
 * GEÇİCİ kayıt tanı günlüğü (2026-09-29) — telefonda kaydın donmasını anlamak için. Sorun çözülünce
 * bu dosya, `RecDebugPanel` ve motordaki `recLog` çağrıları tamamen kaldırılacak.
 *
 * Yalnız `?kayitlog=1` ile açılır (tarayıcıda hatırlanır, `?kayitlog=0` kapatır); kapalıyken her
 * çağrı hiçbir şey yapmaz. `?sahtekamera=1` ek olarak gerçek kamera yerine yapay bir görüntü verir
 * (kamerası olmayan iOS Simülatörü için). Hiçbir veri hiçbir yere gönderilmez: günlük yalnız ekranda
 * görünür ve kişi isterse dosya olarak indirir.
 */

const KEY = 'irticalen:kayitlog';
const MAX_LINES = 20000;

let enabled: boolean | null = null;
const startedAt = Date.now();
const lines: string[] = [];
const listeners = new Set<() => void>();

export function recDebugEnabled(): boolean {
  if (enabled !== null) return enabled;
  try {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('kayitlog');
    if (flag === '1') localStorage.setItem(KEY, '1');
    if (flag === '0') localStorage.removeItem(KEY);
    enabled = flag === '1' || localStorage.getItem(KEY) === '1';
  } catch {
    enabled = false;
  }
  return enabled;
}

export function recLog(message: string): void {
  if (!recDebugEnabled()) return;
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1).padStart(7, ' ');
  lines.push(`${seconds}  ${message}`);
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
  for (const listener of listeners) listener();
}

export function recLogLines(): readonly string[] {
  return lines;
}

export function onRecLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearRecLog(): void {
  lines.length = 0;
  for (const listener of listeners) listener();
}

export function recLogText(): string {
  const header = [
    'irticalen kayıt günlüğü',
    `tarih: ${new Date().toISOString()}`,
    `tarayıcı: ${navigator.userAgent}`,
    `ekran: ${window.screen.width}x${window.screen.height} @${window.devicePixelRatio} · pencere ${window.innerWidth}x${window.innerHeight}`,
    `çekirdek: ${navigator.hardwareConcurrency ?? '?'}`,
    '',
  ];
  return [...header, ...lines].join('\n');
}

type TrackLike = MediaStreamTrack & { muted?: boolean };

/** One line describing a track's live state. */
export function describeTrack(track: TrackLike | undefined | null): string {
  if (!track) return 'yok';
  return `${track.readyState}${track.muted ? ' SUSTU' : ''}${track.enabled ? '' : ' KAPALI'}`;
}

/** Logs every event on a track that can explain a frozen picture or silence. */
export function watchTrack(label: string, track: MediaStreamTrack | undefined | null): void {
  if (!recDebugEnabled() || !track) return;
  let settings = '';
  try {
    const s = track.getSettings();
    settings = ` ${s.width ?? '?'}x${s.height ?? '?'} ${s.frameRate ? Math.round(s.frameRate) + 'fps' : ''}`;
  } catch {
    settings = '';
  }
  recLog(`${label} izi: ${describeTrack(track)}${settings}`);
  for (const type of ['mute', 'unmute', 'ended'] as const) {
    track.addEventListener(type, () => recLog(`${label} izi olayı: ${type} → ${describeTrack(track)}`));
  }
}

/** Logs the <video> events that mean "no new frames". */
export function watchVideo(label: string, video: HTMLVideoElement): void {
  if (!recDebugEnabled()) return;
  for (const type of ['pause', 'play', 'playing', 'waiting', 'stalled', 'emptied', 'ended', 'error', 'resize']) {
    video.addEventListener(type, () =>
      recLog(`${label} video olayı: ${type} (rs=${video.readyState} t=${video.currentTime.toFixed(2)} ${video.videoWidth}x${video.videoHeight})`),
    );
  }
}

let pageWatched = false;

/** Visibility, focus and memory-pressure-ish page events — once per page. */
export function watchPage(): void {
  if (!recDebugEnabled() || pageWatched) return;
  pageWatched = true;
  document.addEventListener('visibilitychange', () => recLog(`sayfa: ${document.visibilityState}`));
  window.addEventListener('pagehide', () => recLog('sayfa: pagehide'));
  window.addEventListener('pageshow', () => recLog('sayfa: pageshow'));
  window.addEventListener('blur', () => recLog('pencere: odak gitti'));
  window.addEventListener('focus', () => recLog('pencere: odak geldi'));
  window.addEventListener('error', (event) => recLog(`HATA: ${event.message}`));
  window.addEventListener('unhandledrejection', (event) => recLog(`HATA (promise): ${String(event.reason)}`));
}

/**
 * `?sahtekamera=1`: camera requests get a generated moving picture (+ a quiet tone when audio is
 * asked for) — lets a camera-less iOS Simulator exercise the exact same recording pipeline.
 */
export function installFakeCameraIfAsked(): void {
  try {
    if (!new URLSearchParams(window.location.search).has('sahtekamera')) return;
    const devices = navigator.mediaDevices;
    if (!devices) return;
    const proto = Object.getPrototypeOf(devices) as { getUserMedia?: (c?: MediaStreamConstraints) => Promise<MediaStream> };
    const original = proto.getUserMedia;
    const real = original ? (c: MediaStreamConstraints) => original.call(devices, c) : undefined;
    const fake = async (constraints?: MediaStreamConstraints): Promise<MediaStream> => {
      try {
        return await fakeStream(constraints, real);
      } catch (error) {
        recLog(`SAHTE KAMERA HATASI: ${String(error)}`);
        throw error;
      }
    };
    // WebKit ignores a plain assignment on the instance — define it on both, writable.
    Object.defineProperty(proto, 'getUserMedia', { value: fake, configurable: true, writable: true });
    Object.defineProperty(devices, 'getUserMedia', { value: fake, configurable: true, writable: true });
    recLog('sahte kamera kuruldu');
  } catch (error) {
    recLog(`sahte kamera kurulamadı: ${String(error)}`);
  }
}

async function fakeStream(
  constraints: MediaStreamConstraints | undefined,
  real: ((c: MediaStreamConstraints) => Promise<MediaStream>) | undefined,
): Promise<MediaStream> {
  {
    {
      const wantsVideo = Boolean(constraints?.video);
      const wantsAudio = Boolean(constraints?.audio);
      const tracks: MediaStreamTrack[] = [];
      if (wantsVideo) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        let frame = 0;
        setInterval(() => {
          if (!ctx) return;
          frame += 1;
          ctx.fillStyle = '#7a8a9a';
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(320 + 150 * Math.sin(frame / 15), 240, 80, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = '48px sans-serif';
          ctx.fillText(String(frame), 20, 60);
        }, 33);
        tracks.push(...canvas.captureStream(30).getVideoTracks());
      }
      if (wantsAudio) {
        let audioTracks: MediaStreamTrack[] = [];
        try {
          // A real mic when one answers quickly; an unanswered prompt must not hang the test.
          const mic = real ? real({ audio: true, video: false }) : Promise.resolve(null);
          const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
          const stream = await Promise.race([mic, timeout]);
          audioTracks = stream ? stream.getAudioTracks() : [];
        } catch {
          audioTracks = [];
        }
        if (audioTracks.length === 0) {
          const audio = new AudioContext();
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          gain.gain.value = 0.02;
          const dest = audio.createMediaStreamDestination();
          osc.connect(gain).connect(dest);
          osc.start();
          audioTracks = dest.stream.getAudioTracks();
        }
        tracks.push(...audioTracks);
      }
      recLog(`SAHTE KAMERA verildi (görüntü=${wantsVideo} ses=${wantsAudio})`);
      return new MediaStream(tracks);
    }
  }
}
