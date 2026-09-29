import type { Dictionary } from '../i18n';

interface Props {
  /** True once the visitor has asked to record — from the click that grants permissions, not only
   * once the engine has actually started (see `pending`). Never persisted: this always starts
   * 'kapalı' on a fresh visit (see CLAUDE.md's task notes). */
  on: boolean;
  /** True while `on` but the engine/streams haven't settled yet (permission prompt still open, or
   * negotiation still in flight) — suppresses the red dot until recording has actually begun. */
  pending: boolean;
  /** `null` while not actively recording (still `pending`, or off). */
  elapsedLabel: string | null;
  dict: Dictionary;
  onToggle: () => void;
  /** Minimalist layout: only the switch — the live readout is rendered elsewhere via
   * `RecordingLive` (see App), so the switch fits next to the category picker. */
  compact?: boolean;
}

/**
 * The always-visible "kendini kaydet" switch on the main screen, next to the wheel/start button —
 * independent of the speech timer (see CLAUDE.md's task notes: recording can start before a topic
 * has even landed). Visually the site's underlined-word toggle, the same ink/pencil convention as
 * `.mode-switch` — never a boxed/pill toggle. Lives inside `.app-shell`, so it goes `inert` together
 * with the rest of the main screen once a session opens (the running overlay has its own indicator
 * and stop button instead — see `TimerOverlay`).
 */
export function RecordingSwitch({ on, pending, elapsedLabel, dict, onToggle, compact = false }: Props) {
  // Two words, like the mode switch ("hazırlıksız · araştırmalı"): the current state carries the
  // thick bar, the other one the thin "clickable" underline — so it is never unclear which word is a
  // label and which one acts. Deliberately NOT wrapped in a view transition: `onToggle` must run
  // synchronously inside the click, or the browser refuses the camera/screen permission prompt.
  const options: { value: boolean; label: string }[] = [
    { value: false, label: dict.record.switchOff },
    { value: true, label: dict.record.switchOn },
  ];
  const onKeyDown = (event: KeyboardEvent): void => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    onToggle();
  };
  return (
    <div class="record-switch-row">
      <div
        class="mode-switch inked record-switch"
        role="radiogroup"
        aria-label={on ? dict.record.switchAriaOn : dict.record.switchAriaOff}
        onKeyDown={onKeyDown}
      >
        <span class="record-switch-label" aria-hidden="true">
          {dict.record.switchLabel}
        </span>
        {options.map((option) => {
          const checked = option.value === on;
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => {
                if (!checked) onToggle();
              }}
            >
              <span class="switch-label">
                {option.label}
                {checked && <span class={`switch-ink record-ink${on ? ' is-live' : ''}`} aria-hidden="true" />}
              </span>
            </button>
          );
        })}
      </div>
      {on && !compact && <RecordingLive pending={pending} elapsedLabel={elapsedLabel} dict={dict} onStop={onToggle} />}
    </div>
  );
}

interface LiveProps {
  pending: boolean;
  elapsedLabel: string | null;
  dict: Dictionary;
  onStop: () => void;
}

/** Red dot + mm:ss + "durdur" while a recording runs. */
export function RecordingLive({ pending, elapsedLabel, dict, onStop }: LiveProps) {
  return (
    <span class="record-switch-live">
      {!pending && <span class="recording-dot" aria-hidden="true" />}
      {elapsedLabel && <span class="record-switch-elapsed">{elapsedLabel}</span>}
      <button type="button" class="record-switch-stop" onClick={onStop}>
        {dict.record.switchStop}
      </button>
    </span>
  );
}
