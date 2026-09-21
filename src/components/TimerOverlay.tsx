import { useEffect, useRef } from 'preact/hooks';
import type { Phase, Mode } from '../lib/types';
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
}

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

  if (!open) return null;

  const progress = totalSec > 0 ? Math.min(1, elapsedSec / totalSec) : 0;
  const isDone = phase === 'done';
  const statusKey = STATUS_BY_PHASE[phase];
  const statusText = statusKey ? (dict.timer[statusKey] as string) : '';
  const showArc = mode === 'off-the-cuff' && (phase === 'speech' || phase === 'done');
  const currentArcStep = speechArcStep(elapsedSec, totalSec);

  return (
    <div
      ref={overlayRef}
      class={`timer-overlay${isDone ? ' is-done' : ''}`}
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
          <div class="timer-logo">
            <Logo state={phase as LogoState} variant="onDark" size={44} />
          </div>

          {mode === 'deep-research' && phase === 'research' && (
            <p class="timer-research-badge">{dict.timer.researching}</p>
          )}

          <p class="timer-topic">{topic}</p>

          {showArc && (
            <ol class="speech-arc" aria-label={dict.timer.arcLabel}>
              {dict.timer.arc.map((label, index) => (
                <li key={label} class={index <= currentArcStep ? 'is-hit' : ''}>
                  {label}
                </li>
              ))}
            </ol>
          )}

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <div class="timer-ring" role="timer" style={{ '--p': String(progress) } as any}>
            <span class="timer-clock">{formatClock(remainingSec)}</span>
          </div>

          <p class="timer-status" aria-live="polite">
            {statusText}
          </p>

          {phase === 'ready' && (
            <p class="timer-up-next">{fill(dict.timer.upNext, { min: speechMinutes })}</p>
          )}

          <div class="timer-actions">
            {phase === 'research' && (
              <button type="button" class="btn btn-primary" onClick={onDoneResearching}>
                {dict.timer.doneResearching}
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
