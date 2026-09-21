/** Prevents the screen from locking/dimming (via the Wake Lock API, when available). */
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
 * Acquires a wake lock. Never throws when the API is unavailable or the
 * request is denied; always returns a (possibly no-op) release function.
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
