import { forwardRef, useImperativeHandle } from 'preact/compat';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
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
}

interface Props {
  /** The active category's topic list. */
  topics: string[];
  /** topicIndex to center the wheel on while idle, or to treat as the spin's starting point. -1 (no topic yet) is treated as 0. */
  startIndex: number;
  spinning: boolean;
  topic: string | null;
  dict: Dictionary;
  locale: Locale;
  /** Bumped on every SPIN_LAND; replays the "landed" emphasis on the big topic display. */
  landKey: number;
}

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
  { topics, startIndex, spinning, topic, dict, locale, landKey },
  ref,
) {
  const drumRef = useRef<HTMLDivElement>(null);
  // Only the rounded position drives a re-render (face text changes); the raw per-frame value
  // never touches Preact state — it's written straight to the drum's CSS custom property.
  const [centerStep, setCenterStep] = useState(0);

  useImperativeHandle(
    ref,
    () => ({
      setPosition(position: number) {
        drumRef.current?.style.setProperty('--wheel-rot', `${position * FACE_ANGLE_DEG}deg`);
        const rounded = Math.round(position);
        setCenterStep((prev) => (prev === rounded ? prev : rounded));
      },
    }),
    [],
  );

  // Idle: park the drum at position 0 so the selected topic sits front-and-center.
  useEffect(() => {
    if (!spinning) {
      setCenterStep(0);
      drumRef.current?.style.setProperty('--wheel-rot', '0deg');
    }
  }, [spinning, startIndex, topics]);

  const safeStartIndex = startIndex < 0 ? 0 : startIndex;
  const hasTopics = topics.length > 0;
  // Before the first topic the wheel is already on the page, drifting slowly: the empty middle read
  // as "something failed to load". It only turns into the big topic once a spin has landed.
  const idleWheel = hasTopics && !spinning && topic === null;
  const showWheel = hasTopics && (spinning || idleWheel);
  const showLanded = !spinning && topic !== null;

  const lines = useMemo(() => (topic ? paperLines(topic, locale) : []), [topic, locale]);
  const len = Math.max(MIN_LEN, ...lines.map((line) => line.length), MIN_LEN);

  const label = spinning ? dict.reel.spinning : topic ? dict.reel.landed : dict.reel.idle;

  return (
    <section class={`topic-stage${idleWheel ? ' is-idle' : ''}`}>
      <p class="reel-label">{label}</p>
      {showWheel ? (
        <div class={`topic-wheel${idleWheel ? ' is-idle' : ''}`} aria-hidden="true">
          <div class="topic-wheel-mask">
            <div class="topic-wheel-drum" ref={drumRef} style={{ '--wheel-rot': '0deg' } as Record<string, string>}>
              {Array.from({ length: FACE_COUNT }, (_, face) => {
                const step = wheelFaceStep(face, FACE_COUNT, centerStep);
                const text = topics[wrapIndex(safeStartIndex + step, topics.length)] ?? '';
                const isCenterFace = !idleWheel && face === wrapIndex(centerStep, FACE_COUNT);
                const scale = textScale(text);
                return (
                  <div
                    class="topic-wheel-face"
                    style={{ transform: `rotateX(${-face * FACE_ANGLE_DEG}deg) translateZ(var(--wheel-radius))` }}
                  >
                    <span
                      class={`topic-wheel-text${isCenterFace ? ' is-center' : ''}`}
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
      {idleWheel ? (
        <p class="topic-sheet is-empty" id="topic-display">
          {dict.reel.empty}
        </p>
      ) : showWheel ? null : showLanded ? (
        <p
          key={landKey}
          class="topic-display"
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
