import type { FramePhase, FrameStage } from './types';

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
  /** What the app is showing right now (see `FrameStage`) — `'speech'` drives `speech`, `'done'`
   * drives `overtime`, everything else (idle/spinning/landed/research/ready) is `pre`. */
  readonly stage: FrameStage;
  /** Milliseconds since "kaydı durdur" was pressed, or `null` while recording normally. Once
   * non-null this always wins — the recording is ending regardless of the other inputs. */
  readonly outroElapsedMs: number | null;
}

/** Pure phase decision table: `outro` (ending) beats `intro` (opening) beats the steady states
 * (`pre`/`speech`/`overtime`), which follow the app's own `stage` one-to-one — a recording may start
 * before the wheel is even spun, so `pre` covers every stage short of the speech timer actually
 * running or having run out. */
export function computeFramePhase(input: PhaseInput): FramePhase {
  if (input.outroElapsedMs !== null) return 'outro';
  if (input.recordingElapsedMs < INTRO_MS) return 'intro';
  if (input.stage === 'speech') return 'speech';
  if (input.stage === 'done') return 'overtime';
  return 'pre';
}

/** Whether the outro grace period has run its course and the recorder should actually be stopped. */
export function outroFinished(outroElapsedMs: number): boolean {
  return outroElapsedMs >= OUTRO_MS;
}

/** How much a tick's mic reading moves `micLevel` toward its instantaneous reading — asymmetric so a
 * spoken syllable snaps the level up immediately but a natural pause lets it fall back gently instead
 * of flickering to 0 between words (see `engine.ts`'s `onTick`). Both are pure weights in (0,1]. */
const MIC_ATTACK = 0.6;
const MIC_RELEASE = 0.15;

/** One smoothing step: `previous` and `instant` are each clamped to 0..1 first (defensive — a caller
 * should already be passing clamped values), then blended by the attack/release rate above depending
 * on whether the level is rising or falling. Pure and cheap enough to call every tick. */
export function smoothMicLevel(previous: number, instant: number): number {
  const clampedPrev = Math.max(0, Math.min(1, previous));
  const clampedInstant = Math.max(0, Math.min(1, instant));
  const rate = clampedInstant > clampedPrev ? MIC_ATTACK : MIC_RELEASE;
  return clampedPrev + (clampedInstant - clampedPrev) * rate;
}

/** A typical spoken RMS (root-mean-square, over a time-domain audio buffer) sits well under 1 — this
 * scales it up into a usable 0..1 range before smoothing. Empirically chosen, not derived: raise it
 * if normal speech still reads as barely-there, lower it if it pins at 1 during normal talking. */
const MIC_RMS_SCALE = 4;

/** Scales a raw RMS reading (>= 0, unbounded above for a clipping/loud input) to 0..1. Non-finite or
 * non-positive input (e.g. a closed/silent analyser) reads as silence. */
export function scaleMicRms(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0) return 0;
  return Math.max(0, Math.min(1, rms * MIC_RMS_SCALE));
}
