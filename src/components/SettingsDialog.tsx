import { useRef } from 'preact/hooks';
import { SPEECH_MIN, SPEECH_MAX, RESEARCH_MIN, RESEARCH_MAX, saveLocale } from '../lib/settings';
import type { RecordFormat, RecordMode } from '../lib/types';
import { COMPOSITE_STYLES, compositeModeFor, type RecordAspect } from '../lib/compositor';
import { fill, localePath, localeTag, type Dictionary, type Locale } from '../i18n';
import { useFocusTrap } from './useFocusTrap';
import { TemplatePreview } from './TemplatePreview';

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
  recordFormat: RecordFormat;
  /** An id from `COMPOSITE_STYLES`. */
  recordStyle: string;
  /** Already clamped to one the selected style actually supports (see `resolveAspectForStyle`). */
  recordAspect: RecordAspect;
  /** Whether the dialog currently renders its wide, two-column layout (>=1100px). */
  isWide: boolean;
  dict: Dictionary;
  onSpeechChange: (minutes: number) => void;
  onResearchChange: (minutes: number) => void;
  onMutedChange: (muted: boolean) => void;
  onHideClockChange: (hideClock: boolean) => void;
  onRecordChange: (mode: RecordMode) => void;
  onRecordFormatChange: (format: RecordFormat) => void;
  onRecordStyleChange: (styleId: string) => void;
  onRecordAspectChange: (aspect: RecordAspect) => void;
  onClose: () => void;
}

/** Settings dialog: language, then speech/research minute ranges + mute, saved immediately on
 * change. The rich/minimalist layout is automatic (viewport width) and has no setting here. */
export function SettingsDialog({
  open,
  locale,
  speechMinutes,
  researchMinutes,
  muted,
  hideClock,
  record,
  recordModes,
  recordFormat,
  recordStyle,
  recordAspect,
  isWide,
  dict,
  onSpeechChange,
  onResearchChange,
  onMutedChange,
  onHideClockChange,
  onRecordChange,
  onRecordFormatChange,
  onRecordStyleChange,
  onRecordAspectChange,
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
              <ChoiceRow
                label={dict.settings.record}
                options={recordModes.map((value) => ({
                  value,
                  label:
                    value === 'off'
                      ? dict.settings.recordOff
                      : value === 'camera'
                        ? dict.settings.recordCamera
                        : value === 'screen'
                          ? dict.settings.recordScreen
                          : dict.settings.recordBoth,
                }))}
                value={record}
                onChange={onRecordChange}
              />
            </div>
          )}

          {recordModes.length > 1 && record !== 'off' && (
            <div class="settings-field">
              <p class="settings-field-label"><span>{dict.settings.format}</span></p>
              <ChoiceRow
                label={dict.settings.format}
                options={[
                  { value: 'template' as const, label: dict.settings.formatTemplate },
                  { value: 'raw' as const, label: dict.settings.formatRaw },
                ]}
                value={recordFormat}
                onChange={onRecordFormatChange}
              />
            </div>
          )}

          {recordModes.length > 1 && record !== 'off' && recordFormat === 'template' && (() => {
            const selectedStyle = COMPOSITE_STYLES.find((style) => style.id === recordStyle) ?? COMPOSITE_STYLES[0];
            const compositeMode = compositeModeFor(record);
            return (
              <div class="settings-field template-settings">
                {COMPOSITE_STYLES.length > 1 && (
                  <>
                    <p class="settings-field-label"><span>{dict.settings.style}</span></p>
                    <ChoiceRow
                      label={dict.settings.style}
                      options={COMPOSITE_STYLES.map((style) => ({
                        value: style.id,
                        label: (dict.record.styles as Record<string, string>)[style.labelKey] ?? style.labelKey,
                      }))}
                      value={recordStyle}
                      onChange={onRecordStyleChange}
                    />
                  </>
                )}
                {selectedStyle.aspects.length > 1 && (
                  <>
                    <p class="settings-field-label"><span>{dict.settings.aspect}</span></p>
                    <ChoiceRow
                      label={dict.settings.aspect}
                      options={selectedStyle.aspects.map((value) => ({
                        value,
                        label: value === 'wide' ? dict.settings.aspectWide : dict.settings.aspectTall,
                      }))}
                      value={recordAspect}
                      onChange={onRecordAspectChange}
                    />
                  </>
                )}
                {compositeMode && (
                  <TemplatePreview style={selectedStyle} aspect={recordAspect} mode={compositeMode} dict={dict} locale={locale} />
                )}
              </div>
            );
          })()}
        </div>

        <p class="settings-saved">{dict.settings.saved}</p>

        <button type="button" class="btn btn-primary settings-done" onClick={onClose}>
          {dict.settings.done}
        </button>
      </div>
    </div>
  );
}

interface ChoiceRowProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** A single-choice row in the site's underlined-word style (same look as the language row):
 * compact enough that the recording options fit the dialog without scrolling. */
function ChoiceRow<T extends string>({ label, options, value, onChange }: ChoiceRowProps<T>) {
  const onKeyDown = (event: KeyboardEvent): void => {
    const index = options.findIndex((option) => option.value === value);
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step || index < 0) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    onChange(next.value);
    const group = event.currentTarget as HTMLElement;
    requestAnimationFrame(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };
  return (
    <div class="mode-switch choice-row" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
