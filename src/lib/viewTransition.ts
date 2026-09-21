/**
 * Thin wrapper around `document.startViewTransition` for same-document transitions (moving the
 * topic word between the wheel, the big landed display, and the timer overlay). Falls back to a
 * plain, immediate DOM update — never throws — when the browser doesn't support the API or the
 * visitor asked for reduced motion.
 */

function prefersReducedMotion(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Resolves once Preact has flushed the state update to the DOM. It must NOT wait for animation
 * frames: while a view transition's update callback is pending the browser suspends rendering, so
 * `requestAnimationFrame` never fires and the transition would stall until the browser gives up
 * (seconds later) and skips it. Preact flushes on a microtask/timeout, so a macrotask is enough.
 */
function domFlushed(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Runs `update` (a synchronous state change, e.g. a reducer dispatch) inside a View Transition when
 * supported. Returns a promise that resolves once the transition has finished (or immediately, in
 * the fallback path) — never rejects.
 */
export function runViewTransition(update: () => void, afterUpdate?: () => void): Promise<void> {
  // `update` must run exactly once no matter what: a transition that is still pending when a newer
  // one starts is aborted by the browser WITHOUT its callback ever being called.
  let ran = false;
  const runOnce = (): void => {
    if (ran) return;
    ran = true;
    update();
  };
  // `afterUpdate` (focus hand-back) runs as soon as the new DOM exists — not when the animation
  // ends, so it can never snatch focus back from something the visitor did in the meantime.
  const settle = (): void => {
    const wasPending = !ran;
    runOnce();
    if (wasPending) setTimeout(() => afterUpdate?.(), 0);
  };
  const supported = typeof document !== 'undefined' && typeof document.startViewTransition === 'function';
  if (!supported || prefersReducedMotion()) {
    runOnce();
    return domFlushed().then(() => afterUpdate?.());
  }
  try {
    const transition = document.startViewTransition(() => {
      runOnce();
      return domFlushed().then(() => afterUpdate?.());
    });
    transition.updateCallbackDone.catch(settle);
    // `ready` can legitimately reject on its own (e.g. a duplicate view-transition-name, or the
    // browser skipping the transition) independently of `finished` — an un-caught rejection there
    // is a silent "Uncaught (in promise)" in the console even though the DOM update above already
    // happened correctly, so it must be swallowed here too.
    transition.ready.catch(() => undefined);
    return transition.finished.catch(() => undefined).then(settle);
  } catch {
    settle();
    return Promise.resolve();
  }
}
