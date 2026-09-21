import { forwardRef, useImperativeHandle } from 'preact/compat';
import { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'preact/hooks';
import type { Dictionary, Locale } from '../i18n';
import { fill } from '../i18n';
import { paperLines } from '../lib/paperLines';
import { wheelFaceStep, wrapIndex } from '../lib/topicPicker';

/** Number of physical rows on the drum (iOS-picker style: an even ring of faces around a hidden cylinder). */
const FACE_COUNT = 12;
/** Angle between two adjacent faces, matching 360deg / FACE_COUNT. */
const FACE_ANGLE_DEG = 360 / FACE_COUNT;
/** Above this character count the face text is scaled down so it keeps to one line. */
const LONG_TEXT_THRESHOLD = 20;
const MIN_TEXT_SCALE = 0.62;
/** Minimum value for --len (the paper-lines longest-line length) so short topics don't blow up the font size. */
const MIN_LEN = 7;

/** Imperative handle so the 60fps spin loop can update rotation without re-rendering Preact state. */
export interface TopicReelHandle {
  /** Sets the drum's fractional position for the current animation frame. */
  setPosition: (position: number) => void;
  /** Reads the drum's current fractional position — the idle drift's current spot, or wherever the
   * previous spin left it — so a new spin can continue from there instead of jumping to 0. */
  getPosition: () => number;
}

interface Props {
  /** The active category's topic list. The drum's position is always anchored to index 0 of this
   * list and persists across spins (see `positionRef`) — no separate "start index" needed. */
  topics: string[];
  spinning: boolean;
  topic: string | null;
  dict: Dictionary;
  locale: Locale;
  /** Bumped on every SPIN_LAND; replays the "landed" emphasis on the big topic display. */
  landKey: number;
  /** False while the timer overlay owns the topic word's view-transition name (it moved there). */
  wordOwner: boolean;
}

/** Idle drift speed, in degrees per second — slow enough to read as "resting", not spinning. */
const IDLE_DRIFT_DEG_PER_SEC = 4;

/** Scales down long topic text so it still fits on one line inside the wheel face. */
function textScale(text: string): number {
  if (text.length <= LONG_TEXT_THRESHOLD) return 1;
  return Math.max(MIN_TEXT_SCALE, LONG_TEXT_THRESHOLD / text.length);
}

/**
 * The topic display, "kâğıt üstünde mürekkep" style:
 * - while spinning: a real rotating wheel (iOS UIPickerView style), left-aligned, ink center row / pencil neighbours.
 * - once landed: the wheel is replaced by a big lowercase, word-safe multi-line topic (paperLines), ending in the
 *   red full stop.
 * - no topic yet: a pencil-coloured empty-state line, no wheel, no dot.
 */
export const TopicReel = forwardRef<TopicReelHandle, Props>(function TopicReel(
  { topics, spinning, topic, dict, locale, landKey, wordOwner },
  ref,
) {
  const drumRef = useRef<HTMLDivElement>(null);
  // The single source of truth for the drum's fractional position — read by getPosition() so a new
  // spin (or the idle drift) can continue from wherever the drum already is, never jumping to 0.
  const positionRef = useRef(0);
  // Only the rounded position drives a re-render (face text changes); the raw per-frame value
  // never touches Preact state — it's written straight to the drum's CSS custom property.
  const [centerStep, setCenterStep] = useState(0);

  const applyPosition = (position: number): void => {
    positionRef.current = position;
    drumRef.current?.style.setProperty('--wheel-rot', `${position * FACE_ANGLE_DEG}deg`);
    const rounded = Math.round(position);
    setCenterStep((prev) => (prev === rounded ? prev : rounded));
  };

  useImperativeHandle(
    ref,
    () => ({
      setPosition(position: number) {
        applyPosition(position);
      },
      getPosition() {
        return positionRef.current;
      },
    }),
    [],
  );

  // A fresh topic list (category/mode switch) starts its own idle drift from scratch — the old
  // position was relative to a list that no longer applies. Spins and landings never reset it: the
  // wheel keeps drifting/resting exactly where it last was, so the next spin has no jump to make.
  useEffect(() => {
    applyPosition(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics]);

  const hasTopics = topics.length > 0;
  // Before the first topic the wheel is already on the page, drifting slowly: the empty middle read
  // as "something failed to load". It only turns into the big topic once a spin has landed.
  const idleWheel = hasTopics && !spinning && topic === null;
  const showWheel = hasTopics && (spinning || idleWheel);
  const showLanded = !spinning && topic !== null;

  // Idle drift: a slow, continuous rotation driven by the same position/RAF mechanism the spin uses
  // (never a separate CSS animation) so the handoff between "resting" and "spinning" never jumps.
  // Paused entirely — not just visually stalled — while the tab is hidden or motion is reduced.
  useEffect(() => {
    if (!idleWheel) return;
    let reduced = false;
    try {
      reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      reduced = false;
    }
    if (reduced) return;

    let raf = 0;
    let last: number | null = null;
    const stepPerSec = IDLE_DRIFT_DEG_PER_SEC / FACE_ANGLE_DEG;

    const tick = (ts: number): void => {
      if (last !== null) {
        const dt = (ts - last) / 1000;
        applyPosition(positionRef.current + dt * stepPerSec);
      }
      last = ts;
      raf = requestAnimationFrame(tick);
    };
    const start = (): void => {
      last = null;
      raf = requestAnimationFrame(tick);
    };
    const stop = (): void => {
      cancelAnimationFrame(raf);
    };
    const onVisibility = (): void => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idleWheel]);

  // Belt and braces for the remount above: re-assert the stored angle as soon as the drum exists.
  useLayoutEffect(() => {
    // While the wheel is off screen, fold the position back into one full cycle (a multiple of both
    // the 12 faces and the list length, so faces and texts stay exactly where they were). Otherwise
    // the angle grows without bound and 32-bit transform math starts to jitter after many spins.
    if (!showWheel && topics.length > 0) {
      const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
      const cycle = (FACE_COUNT * topics.length) / gcd(FACE_COUNT, topics.length);
      positionRef.current = ((positionRef.current % cycle) + cycle) % cycle;
      setCenterStep(Math.round(positionRef.current));
      return;
    }
    if (showWheel) applyPosition(positionRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWheel]);

  const lines = useMemo(() => (topic ? paperLines(topic, locale) : []), [topic, locale]);
  const len = Math.max(MIN_LEN, ...lines.map((line) => line.length), MIN_LEN);

  const label = spinning ? dict.reel.spinning : topic ? dict.reel.landed : dict.reel.idle;

  return (
    <section class="topic-stage">
      <p class="reel-label">{label}</p>
      {showWheel ? (
        <div class={`topic-wheel${idleWheel ? ' is-idle' : ''}`} aria-hidden="true">
          <div class="topic-wheel-mask">
            <div
              class="topic-wheel-drum"
              ref={drumRef}
              // The drum is unmounted while a topic is on screen. When it comes back it must show the
              // angle it was left at, otherwise the front face is a different word than the one landing on it.
              style={{ '--wheel-rot': `${positionRef.current * FACE_ANGLE_DEG}deg` } as Record<string, string>}
            >
              {Array.from({ length: FACE_COUNT }, (_, face) => {
                const step = wheelFaceStep(face, FACE_COUNT, centerStep);
                const text = topics[wrapIndex(step, topics.length)] ?? '';
                const isCenterFace = !idleWheel && face === wrapIndex(centerStep, FACE_COUNT);
                const scale = textScale(text);
                return (
                  <div
                    class="topic-wheel-face"
                    style={{ transform: `rotateX(${-face * FACE_ANGLE_DEG}deg) translateZ(var(--wheel-radius))` }}
                  >
                    <span
                      class={`topic-wheel-text${isCenterFace ? ' is-center' : ''}${isCenterFace && wordOwner ? ' vt-word' : ''}`}
                      style={scale !== 1 ? { '--face-scale': String(scale) } as Record<string, string> : undefined}
                    >
                      {text.toLocaleLowerCase(locale)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div class="topic-wheel-band topic-wheel-band-top" />
          <div class="topic-wheel-band topic-wheel-band-bottom" />
        </div>
      ) : null}
      {showWheel ? (
        // Same slot whether idle or spinning — only its opacity changes, so losing it never
        // reflows the wheel above it (it used to be conditionally unmounted, which jumped the
        // whole stage the moment a spin started).
        <p
          class={`topic-sheet is-empty${idleWheel ? '' : ' is-caption-hidden'}`}
          id="topic-display"
          aria-hidden={idleWheel ? undefined : 'true'}
        >
          {dict.reel.empty}
        </p>
      ) : showLanded ? (
        <p
          key={landKey}
          class={`topic-display${wordOwner ? ' vt-word' : ''}`}
          id="topic-display"
          style={{ '--len': String(len) } as Record<string, string>}
        >
          {lines.map((line, index) => (
            <span key={`${landKey}-${index}`} class="topic-line">
              {line}
              {index === lines.length - 1 && <i class="dot">.</i>}
            </span>
          ))}
        </p>
      ) : (
        <p class="topic-sheet is-empty" id="topic-display">
          {dict.reel.empty}
        </p>
      )}
      <p class="sr-only" aria-live="polite">
        {!spinning && topic ? fill(dict.reel.announce, { topic }) : ''}
      </p>
    </section>
  );
});
