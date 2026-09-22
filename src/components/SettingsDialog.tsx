import { useRef } from 'preact/hooks';
import { SPEECH_MIN, SPEECH_MAX, RESEARCH_MIN, RESEARCH_MAX } from '../lib/settings';
import { fill, type Dictionary } from '../i18n';
import { useFocusTrap } from './useFocusTrap';

interface Props {
  open: boolean;
  speechMinutes: number;
  researchMinutes: number;
  muted: boolean;
  hideClock: boolean;
  dict: Dictionary;
  onSpeechChange: (minutes: number) => void;
  onResearchChange: (minutes: number) => void;
  onMutedChange: (muted: boolean) => void;
  onHideClockChange: (hideClock: boolean) => void;
  onClose: () => void;
}

/** Settings dialog: speech/research minute ranges + mute, saved immediately on change. */
export function SettingsDialog({
  open,
  speechMinutes,
  researchMinutes,
  muted,
  hideClock,
  dict,
  onSpeechChange,
  onResearchChange,
  onMutedChange,
  onHideClockChange,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef, onClose);

  if (!open) return null;

  const speechValueText = fill(dict.settings.minutes, { min: speechMinutes });
  const researchValueText = fill(dict.settings.minutes, { min: researchMinutes });

  return (
    <div class="settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} class="settings-dialog" role="dialog" aria-modal="true" aria-label={dict.settings.title}>
        <h2 class="settings-title">{dict.settings.title}</h2>
        <p class="settings-hint">{dict.settings.hint}</p>

        <div class="settings-field">
          <label class="settings-field-label" for="settings-speech">
            <span>{dict.settings.speech}</span>
            <span class="settings-range-value">{speechValueText}</span>
          </label>
          <input
            id="settings-speech"
            type="range"
            min={SPEECH_MIN}
            max={SPEECH_MAX}
            step={1}
            value={speechMinutes}
            aria-valuetext={speechValueText}
            onInput={(event) => onSpeechChange(Number((event.target as HTMLInputElement).value))}
          />
        </div>

        <div class="settings-field">
          <label class="settings-field-label" for="settings-research">
            <span>{dict.settings.research}</span>
            <span class="settings-range-value">{researchValueText}</span>
          </label>
          <p class="settings-field-hint">{dict.settings.researchHint}</p>
          <input
            id="settings-research"
            type="range"
            min={RESEARCH_MIN}
            max={RESEARCH_MAX}
            step={1}
            value={researchMinutes}
            aria-valuetext={researchValueText}
            onInput={(event) => onResearchChange(Number((event.target as HTMLInputElement).value))}
          />
        </div>

        <div class="settings-mute-row">
          <input
            id="settings-mute"
            type="checkbox"
            checked={muted}
            onChange={(event) => onMutedChange((event.target as HTMLInputElement).checked)}
          />
          <label for="settings-mute">{dict.settings.mute}</label>
        </div>

        <div class="settings-mute-row">
          <input
            id="settings-hide-clock"
            type="checkbox"
            checked={hideClock}
            onChange={(event) => onHideClockChange((event.target as HTMLInputElement).checked)}
          />
          <label for="settings-hide-clock">{dict.settings.hideClock}</label>
        </div>

        <p class="settings-saved">{dict.settings.saved}</p>

        <button type="button" class="btn btn-primary settings-done" onClick={onClose}>
          {dict.settings.done}
        </button>
      </div>
    </div>
  );
}
