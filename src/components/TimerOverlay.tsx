import { useEffect, useRef } from 'preact/hooks';
import type { Phase, Mode } from '../lib/types';
import type { ResearchStage } from '../lib/researchStages';
import { formatClock, speechArcStep } from '../lib/timer';
import { fill, type Dictionary } from '../i18n';
import { useFocusTrap } from './useFocusTrap';
import { Logo, type LogoState } from './Logo';
import { SharePanel, type ShareChannel } from './SharePanel';

interface Props {
  mode: Mode;
  phase: Phase;
  topic: string | null;
  remainingSec: number;
  totalSec: number;
  elapsedSec: number;
  speechMinutes: number;
  dict: Dictionary;
  onDoneResearching: () => void;
  onReadyToSpeak: () => void;
  onClose: () => void;
  onShareOpen: () => void;
  sharePanelOpen: boolean;
  shareImageUrl: string;
  shareText: string;
  shareUrl: string;
  onShareBack: () => void;
  onShareTrack: (channel: ShareChannel) => void;
  /** Research stages in order (from the plan) and the index of the current one. */
  researchStages: ResearchStage[];
  researchStage: number;
  gatherChecked: boolean[];
  onToggleGather: (index: number) => void;
  onNextStage: () => void;
  hideClock: boolean;
  onToggleClock: () => void;
}

const STAGE_INDEX: Record<ResearchStage, number> = { gather: 0, shape: 1, warm: 2 };

/** Which of the five gathered things feed each part of the speech outline (What is it? / An example / What do I think?). */
const OUTLINE_SOURCES: readonly (readonly number[])[] = [[0, 1], [3, 2], [4]];

const STATUS_BY_PHASE: Record<Phase, keyof Dictionary['timer'] | null> = {
  idle: null,
  research: 'statusResearch',
  ready: 'statusReady',
  speech: 'statusSpeech',
  done: 'statusDone',
};

/** Full-screen countdown dialog: ring progress, MM:SS clock, and phase-specific actions. */
export function TimerOverlay({
  mode,
  phase,
  topic,
  remainingSec,
  totalSec,
  elapsedSec,
  speechMinutes,
  dict,
  onDoneResearching,
  onReadyToSpeak,
  onClose,
  onShareOpen,
  sharePanelOpen,
  shareImageUrl,
  shareText,
  shareUrl,
  onShareBack,
  onShareTrack,
  researchStages,
  researchStage,
  gatherChecked,
  onToggleGather,
  onNextStage,
  hideClock,
  onToggleClock,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const open = phase !== 'idle';
  // Esc closes the share panel first (back to the done screen), only then the whole overlay.
  useFocusTrap(open, overlayRef, sharePanelOpen ? onShareBack : onClose);

  // Coming back from the share panel: that panel's buttons are gone, so hand focus back to "paylaş".
  const shareTriggerRef = useRef<HTMLButtonElement>(null);
  const wasSharePanelOpen = useRef(false);
  useEffect(() => {
    if (wasSharePanelOpen.current && !sharePanelOpen) shareTriggerRef.current?.focus();
    wasSharePanelOpen.current = sharePanelOpen;
  }, [sharePanelOpen]);

  // A stage change swaps the guide (and on the last stage drops "sonraki bölüm"), so a focused
  // button can vanish under the keyboard user — hand focus to "araştırmam bitti" instead of <body>.
  const doneResearchingRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (phase !== 'research') return;
    const id = setTimeout(() => {
      const active = document.activeElement;
      if (!active || active === document.body || !overlayRef.current?.contains(active)) {
        doneResearchingRef.current?.focus();
      }
    }, 0);
    return () => clearTimeout(id);
  }, [researchStage, phase]);

  if (!open) return null;

  const progress = totalSec > 0 ? Math.min(1, elapsedSec / totalSec) : 0;
  const isDone = phase === 'done';
  const statusKey = STATUS_BY_PHASE[phase];
  const isResearch = phase === 'research';
  const stage = researchStages[researchStage] ?? 'gather';
  const stageKey = STAGE_INDEX[stage];
  const statusText = isResearch
    ? dict.timer.stageStatus[stageKey]
    : statusKey
      ? (dict.timer[statusKey] as string)
      : '';
  const stageHint = isResearch ? dict.timer.stageHint[stageKey] : '';
  const hasNextStage = isResearch && researchStage < researchStages.length - 1;
  // The finished screen has nothing left to be anxious about — the time shows again there.
  const clockHidden = hideClock && !isDone;
  // Both modes speak along the same outline — in researched mode it is the one just built.
  const showArc = phase === 'speech' || phase === 'done';
  const currentArcStep = speechArcStep(elapsedSec, totalSec);

  return (
    <div
      ref={overlayRef}
      class={`timer-overlay${isDone ? ' is-done' : ''}${clockHidden ? ' is-clock-hidden' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={dict.timer.dialogLabel}
    >
      {isDone && sharePanelOpen ? (
        <SharePanel
          dict={dict}
          imageUrl={shareImageUrl}
          text={shareText}
          url={shareUrl}
          onBack={onShareBack}
          onTrack={onShareTrack}
        />
      ) : (
        <>
          <div class="timer-logo timer-rise" style={{ animationDelay: '0ms' } as Record<string, string>}>
            <Logo state={phase as LogoState} variant="onDark" size={44} />
          </div>

          {mode === 'deep-research' && phase === 'research' && (
            <p class="timer-research-badge timer-rise" style={{ animationDelay: '40ms' } as Record<string, string>}>
              {dict.timer.researching}
            </p>
          )}

          <p class="timer-topic vt-word">{topic}</p>

          {/* Everything below the word rises up from under it, staggered — it just arrived. */}
          {showArc && (
            <ol
              class="speech-arc timer-rise"
              style={{ animationDelay: '80ms' } as Record<string, string>}
              aria-label={dict.timer.arcLabel}
            >
              {dict.timer.arc.map((label, index) => (
                <li key={label} class={index <= currentArcStep ? 'is-hit' : ''}>
                  {label}
                </li>
              ))}
            </ol>
          )}

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <div
            class="timer-ring timer-rise"
            role="timer"
            style={{ '--p': String(progress), animationDelay: '120ms' } as any}
            onClick={clockHidden ? onToggleClock : undefined}
          >
            <span class="timer-clock">{formatClock(remainingSec)}</span>
          </div>

          {!isDone && (
            <button
              type="button"
              class="clock-toggle timer-rise"
              style={{ animationDelay: '140ms' } as Record<string, string>}
              onClick={onToggleClock}
            >
              {hideClock ? dict.timer.showClock : dict.timer.hideClock}
            </button>
          )}

          {isResearch && (
            <ol
              class="speech-arc research-stages timer-rise"
              style={{ animationDelay: '80ms' } as Record<string, string>}
              aria-label={dict.timer.stagesLabel}
            >
              {researchStages.map((id, index) => (
                <li
                  key={id}
                  class={index === researchStage ? 'is-hit' : index < researchStage ? 'is-past' : ''}
                  aria-current={index === researchStage ? 'step' : undefined}
                >
                  {dict.timer.stages[STAGE_INDEX[id]]}
                </li>
              ))}
            </ol>
          )}

          <p class="timer-status timer-rise" style={{ animationDelay: '160ms' } as Record<string, string>} aria-live="polite">
            {statusText}
          </p>

          {isResearch && (
            // Keyed by stage: each new stage's guide rises in fresh, like everything else that arrives.
            <div key={stage} class="research-guide timer-rise" style={{ animationDelay: '180ms' } as Record<string, string>}>
              {stageHint && <p class="research-hint">{stageHint}</p>}
              {stage === 'gather' ? (
                <ul class="gather-list" aria-label={dict.timer.gatherLabel}>
                  {dict.timer.gather.map(([title, hint], index) => (
                    <li key={title}>
                      <button
                        type="button"
                        class={`gather-item${gatherChecked[index] ? ' is-checked' : ''}${index === 4 ? ' is-key' : ''}`}
                        aria-pressed={gatherChecked[index] ?? false}
                        onClick={() => onToggleGather(index)}
                      >
                        <span class="gather-title">{title}</span>
                        <span class="gather-hint">{hint}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ol class="outline-list" aria-label={dict.timer.arcLabel}>
                  {dict.timer.arc.map((heading, row) => (
                    <li key={heading}>
                      <span class="outline-heading">{heading}</span>
                      <span class="outline-sources">
                        {/* Same five things as in "topla", still tickable here — a find can come late. */}
                        {OUTLINE_SOURCES[row].map((source) => (
                          <button
                            key={source}
                            type="button"
                            class={`outline-source${gatherChecked[source] ? ' is-checked' : ''}`}
                            aria-pressed={gatherChecked[source] ?? false}
                            onClick={() => onToggleGather(source)}
                          >
                            {dict.timer.gather[source][0]}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {phase === 'ready' && (
            <p class="timer-up-next timer-rise" style={{ animationDelay: '200ms' } as Record<string, string>}>
              {fill(dict.timer.upNext, { min: speechMinutes })}
            </p>
          )}

          <div class="timer-actions timer-rise" style={{ animationDelay: '220ms' } as Record<string, string>}>
            {phase === 'research' && (
              <button ref={doneResearchingRef} type="button" class="btn btn-primary" onClick={onDoneResearching}>
                {dict.timer.doneResearching}
              </button>
            )}
            {hasNextStage && (
              <button type="button" class="btn btn-secondary" onClick={onNextStage}>
                {dict.timer.nextStage}
              </button>
            )}
            {phase === 'ready' && (
              <button type="button" class="btn btn-primary" onClick={onReadyToSpeak}>
                {dict.timer.readyToSpeak}
              </button>
            )}
            {isDone && (
              <button ref={shareTriggerRef} type="button" class="btn btn-secondary" onClick={onShareOpen}>
                {dict.timer.share}
              </button>
            )}
            <button type="button" class="btn btn-secondary" onClick={onClose}>
              {dict.timer.close}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
