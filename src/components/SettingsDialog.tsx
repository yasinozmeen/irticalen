import { useRef } from 'preact/hooks';
import { SPEECH_MIN, SPEECH_MAX, RESEARCH_MIN, RESEARCH_MAX, saveLocale } from '../lib/settings';
import type { RecordMode } from '../lib/types';
import type { ViewMode } from '../lib/view';
import { fill, localePath, localeTag, type Dictionary, type Locale } from '../i18n';
import { useFocusTrap } from './useFocusTrap';

interface Props {
  open: boolean;
  locale: Locale;
  speechMinutes: number;
  researchMinutes: number;
  muted: boolean;
  hideClock: boolean;
  record: RecordMode;
  /** Which modes this browser can actually do — 'off' alone means the whole section stays hidden. */
  recordModes: readonly RecordMode[];
  /** The "görünüm" (view) row only ever shows on a wide screen — a narrow one is always minimalist. */
  isWide: boolean;
  view: ViewMode;
  dict: Dictionary;
  onSpeechChange: (minutes: number) => void;
  onResearchChange: (minutes: number) => void;
  onMutedChange: (muted: boolean) => void;
  onHideClockChange: (hideClock: boolean) => void;
  onRecordChange: (mode: RecordMode) => void;
  onViewChange: (view: ViewMode) => void;
  onClose: () => void;
}

/** Settings dialog: language + (on wide screens) view, then speech/research minute ranges + mute,
 * saved immediately on change. */
export function SettingsDialog({
  open,
  locale,
  speechMinutes,
  researchMinutes,
  muted,
  hideClock,
  record,
  recordModes,
  isWide,
  view,
  dict,
  onSpeechChange,
  onResearchChange,
  onMutedChange,
  onHideClockChange,
  onRecordChange,
  onViewChange,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef, onClose);

  if (!open) return null;

  const speechValueText = fill(dict.settings.minutes, { min: speechMinutes });
  const researchValueText = fill(dict.settings.minutes, { min: researchMinutes });
  const otherLocale: Locale = locale === 'tr' ? 'en' : 'tr';

  return (
    <div class="settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} class="settings-dialog" role="dialog" aria-modal="true" aria-label={dict.settings.title}>
        <h2 class="settings-title">{dict.settings.title}</h2>

        {/* On a wide screen this splits into two flowing columns (see .settings-columns.is-wide) so
            the dialog — now longer, with the language and view rows added — still fits at 1280×713
            without its own internal scroll. Narrower than that, it stays one plain stacked column. */}
        <div class={`settings-columns${isWide ? ' is-wide' : ''}`}>
          <div class="settings-field">
            <span class="settings-field-label">
              <span>{dict.settings.language}</span>
            </span>
            <div class="mode-switch lang-switch" role="group" aria-label={dict.settings.language}>
              <span aria-current="true">{dict.language.selfName}</span>
              <a
                href={localePath(otherLocale)}
                hreflang={localeTag[otherLocale]}
                lang={localeTag[otherLocale]}
                onClick={() => saveLocale(otherLocale)}
              >
                {dict.language.switchTo}
              </a>
            </div>
          </div>

          {isWide && (
            <div class="settings-field">
              <span class="settings-field-label">
                <span>{dict.settings.view}</span>
              </span>
              <div class="mode-switch" role="radiogroup" aria-label={dict.settings.view}>
                <button type="button" role="radio" aria-checked={view === 'minimal'} onClick={() => onViewChange('minimal')}>
                  {dict.settings.viewMinimal}
                </button>
                <button type="button" role="radio" aria-checked={view === 'rich'} onClick={() => onViewChange('rich')}>
                  {dict.settings.viewRich}
                </button>
              </div>
              <p class="settings-field-hint">{dict.settings.viewHint}</p>
            </div>
          )}

          <hr class="settings-sep" />
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

          {recordModes.length > 1 && (
            <div class="settings-field">
              <p class="settings-field-label"><span>{dict.settings.record}</span></p>
              <p class="settings-field-hint">{dict.settings.recordHint}</p>
              <div class="settings-record-group" role="radiogroup" aria-label={dict.settings.record}>
                {recordModes.map((value) => {
                  const label =
                    value === 'off'
                      ? dict.settings.recordOff
                      : value === 'camera'
                        ? dict.settings.recordCamera
                        : value === 'screen'
                          ? dict.settings.recordScreen
                          : dict.settings.recordBoth;
                  return (
                    <div class="settings-mute-row" key={value}>
                      <input
                        id={`settings-record-${value}`}
                        type="radio"
                        name="settings-record"
                        checked={record === value}
                        onChange={() => onRecordChange(value)}
                      />
                      <label for={`settings-record-${value}`}>{label}</label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <p class="settings-saved">{dict.settings.saved}</p>

        <button type="button" class="btn btn-primary settings-done" onClick={onClose}>
          {dict.settings.done}
        </button>
      </div>
    </div>
  );
}
