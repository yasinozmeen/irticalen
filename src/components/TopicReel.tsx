import { forwardRef, useImperativeHandle } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Dictionary } from '../i18n';
import { fill } from '../i18n';
import { wheelFaceStep, wrapIndex } from '../lib/topicPicker';

/** Number of physical rows on the drum (iOS-picker style: an even ring of faces around a hidden cylinder). */
const FACE_COUNT = 12;
/** Angle between two adjacent faces, matching 360deg / FACE_COUNT. */
const FACE_ANGLE_DEG = 360 / FACE_COUNT;
/** Above this character count the face text is scaled down so it keeps to one line. */
const LONG_TEXT_THRESHOLD = 20;
const MIN_TEXT_SCALE = 0.62;

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
  /** Bumped on every SPIN_LAND; replays the "landed" emphasis on the centered face. */
  landKey: number;
}

/** Scales down long topic text so it still fits on one line inside the wheel face. */
function textScale(text: string): number {
  if (text.length <= LONG_TEXT_THRESHOLD) return 1;
  return Math.max(MIN_TEXT_SCALE, LONG_TEXT_THRESHOLD / text.length);
}

/**
 * The topic display: a real rotating wheel (iOS UIPickerView style) while a category has topics.
 * A hidden, horizontal-axis cylinder faces the viewer; spinning moves it via `setPosition`
 * (imperative, called every animation frame) while topic text per-face only recomputes on
 * integer position changes, keeping the RAF loop cheap.
 */
export const TopicReel = forwardRef<TopicReelHandle, Props>(function TopicReel(
  { topics, startIndex, spinning, topic, dict, landKey },
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
  const showWheel = hasTopics && (spinning || topic !== null);

  const label = spinning ? dict.reel.spinning : topic ? dict.reel.landed : dict.reel.idle;

  return (
    <section class="topic-stage">
      <p class="reel-label">{label}</p>
      {showWheel ? (
        <div class="topic-wheel" aria-hidden="true">
          <div class="topic-wheel-mask">
            <div class="topic-wheel-drum" ref={drumRef} style={{ '--wheel-rot': '0deg' } as Record<string, string>}>
              {Array.from({ length: FACE_COUNT }, (_, face) => {
                const step = wheelFaceStep(face, FACE_COUNT, centerStep);
                const text = topics[wrapIndex(safeStartIndex + step, topics.length)] ?? '';
                const isCenterFace = face === 0;
                const showLanded = isCenterFace && !spinning && topic !== null;
                const scale = textScale(text);
                return (
                  <div
                    class="topic-wheel-face"
                    style={{ transform: `rotateX(${-face * FACE_ANGLE_DEG}deg) translateZ(var(--wheel-radius))` }}
                  >
                    <span
                      key={showLanded ? `landed-${landKey}` : `face-${face}`}
                      class={`topic-wheel-text${showLanded ? ' is-landed' : ''}`}
                      style={scale !== 1 ? { '--face-scale': String(scale) } as Record<string, string> : undefined}
                    >
                      {text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div class="topic-wheel-band topic-wheel-band-top" />
          <div class="topic-wheel-band topic-wheel-band-bottom" />
        </div>
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
