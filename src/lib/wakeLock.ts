/** Ekranın kilitlenmesini/kararmasını engeller (varsa Wake Lock API ile). */
export type ReleaseWakeLock = () => void;

interface WakeLockSentinelLike {
  release(): Promise<void>;
}

interface NavigatorWithWakeLock {
  wakeLock: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
}

/**
 * Wake Lock alır. API yoksa ya da istek reddedilirse asla fırlatmaz;
 * her durumda no-op bir serbest bırakma fonksiyonu döner.
 */
export async function acquireWakeLock(): Promise<ReleaseWakeLock> {
  const noop: ReleaseWakeLock = () => {};
  try {
    const nav = (globalThis as unknown as { navigator?: NavigatorWithWakeLock }).navigator;
    if (!nav || !nav.wakeLock || typeof nav.wakeLock.request !== 'function') {
      return noop;
    }
    const sentinel = await nav.wakeLock.request('screen');
    let released = false;
    return () => {
      if (released) return;
      released = true;
      try {
        void sentinel.release();
      } catch {
        // no-op
      }
    };
  } catch {
    return noop;
  }
}
