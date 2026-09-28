/**
 * The composite recording's clock. A dedicated Worker's `setInterval` keeps firing at a steady
 * cadence even while the tab is backgrounded (e.g. the visitor switched to the window they're
 * screen-sharing) — a `requestAnimationFrame` loop on the main thread would stall right then, which
 * is exactly when it must not. This file only ever posts a bare `{ type: 'tick' }`; all drawing
 * happens back on the main thread (see `engine.ts`'s `onTick`), since the canvas it draws to was
 * never transferred here.
 *
 * Typed via a cast rather than `/// <reference lib="webworker" />` so this file can stay inside the
 * project's normal (DOM-lib) `tsconfig.json` without a `self`/`Window` conflict against every other
 * file `pnpm run check` type-checks.
 */

interface TickMessage {
  type: 'start' | 'stop' | 'interval';
  ms?: number;
}

interface WorkerGlobal {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent<TickMessage>) => void) | null;
}

const worker = self as unknown as WorkerGlobal;

let intervalId: ReturnType<typeof setInterval> | null = null;

function clearTicking(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

worker.onmessage = (event) => {
  const message = event.data;
  if (!message) return;
  if (message.type === 'stop') {
    clearTicking();
    return;
  }
  if (message.type === 'start' || message.type === 'interval') {
    clearTicking();
    const ms = message.ms && message.ms > 0 ? message.ms : 1000 / 30;
    intervalId = setInterval(() => {
      worker.postMessage({ type: 'tick' });
    }, ms);
  }
};
