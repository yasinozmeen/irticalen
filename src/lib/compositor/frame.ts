import type { FramePhase } from './types';

/** How long the opening card (`'intro'`) shows, from the moment the composite recording itself
 * starts — independent of the speech timer, which may still show 00:00 during it. */
export const INTRO_MS = 3000;

/** How long the closing card (`'outro'`) is drawn for after "kaydı durdur" is pressed, before the
 * recorder is actually stopped and the file finalized — long enough to not cut off mid-word/mid-cue,
 * short enough to not feel like a hang (see `engine.ts`'s `requestStop`). */
export const OUTRO_MS = 2000;

export interface PhaseInput {
  /** Milliseconds since the composite recording itself started. */
  readonly recordingElapsedMs: number;
  /** Speech timer's elapsed/total seconds (both hold at `totalSec` once time is up). */
  readonly elapsedSec: number;
  readonly totalSec: number;
  /** Milliseconds since "kaydı durdur" was pressed, or `null` while recording normally. Once
   * non-null this always wins — the recording is ending regardless of the other inputs. */
  readonly outroElapsedMs: number | null;
}

/** Pure phase decision table: `outro` (ending) beats `intro` (opening) beats `overtime`/`speech`
 * (steady state). `totalSec <= 0` (e.g. before the speech timer's length is known) never reports
 * `overtime` — there is nothing to have run out yet. */
export function computeFramePhase(input: PhaseInput): FramePhase {
  if (input.outroElapsedMs !== null) return 'outro';
  if (input.recordingElapsedMs < INTRO_MS) return 'intro';
  if (input.totalSec > 0 && input.elapsedSec >= input.totalSec) return 'overtime';
  return 'speech';
}

/** Whether the outro grace period has run its course and the recorder should actually be stopped. */
export function outroFinished(outroElapsedMs: number): boolean {
  return outroElapsedMs >= OUTRO_MS;
}
