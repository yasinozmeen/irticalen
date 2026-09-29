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

/** How many running transitions currently hold each `vt-<scope>` class on <html>. */
const activeScopes = new Map<string, number>();

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
 *
 * `scope` puts a `vt-<scope>` class on <html> for exactly the length of this transition, so CSS can
 * give elements a `view-transition-name` only while it runs (`.vt-switch .x { view-transition-name:
 * … }`). A name that is always on would lift that element above sheets and dialogs in every other
 * transition on the page.
 */
export function runViewTransition(update: () => void, afterUpdate?: () => void, scope?: string): Promise<void> {
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
  const root = document.documentElement;
  const scopeClass = scope ? `vt-${scope}` : null;
  // Added before the call so the OLD snapshot is captured with the names too. Counted, because a
  // quick second click starts a new transition before the first one's `finished` has settled.
  if (scopeClass) {
    activeScopes.set(scopeClass, (activeScopes.get(scopeClass) ?? 0) + 1);
    root.classList.add(scopeClass);
  }
  let unscoped = false;
  const unscope = (): void => {
    if (!scopeClass || unscoped) return;
    unscoped = true;
    const left = (activeScopes.get(scopeClass) ?? 1) - 1;
    activeScopes.set(scopeClass, left);
    if (left <= 0) root.classList.remove(scopeClass);
  };
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
    return transition.finished
      .catch(() => undefined)
      .then(() => {
        unscope();
        settle();
      });
  } catch {
    unscope();
    settle();
    return Promise.resolve();
  }
}
