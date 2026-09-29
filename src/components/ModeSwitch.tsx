import { useRef } from 'preact/hooks';
import type { Mode } from '../lib/types';
import type { Dictionary } from '../i18n';
import { runViewTransition } from '../lib/viewTransition';

interface Props {
  mode: Mode;
  disabled: boolean;
  dict: Dictionary;
  onChange: (mode: Mode) => void;
}

const MODES: Mode[] = ['off-the-cuff', 'deep-research'];

/**
 * Two-way mode switch: WAI-ARIA radiogroup with roving tabindex and arrow-key navigation. The
 * underline is a real element (`.switch-ink`) rather than text-decoration, so on a change it slides
 * from one word to the other (see `vt-switch` in switch-motion.css) while the page below re-flows.
 */
export function ModeSwitch({ mode, disabled, dict, onChange }: Props) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const change = (next: Mode): void => {
    if (next === mode) return;
    void runViewTransition(() => onChange(next), undefined, 'switch');
  };

  const select = (index: number): void => {
    const next = MODES[(index + MODES.length) % MODES.length];
    change(next);
    buttonRefs.current[MODES.indexOf(next)]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent, index: number): void => {
    if (disabled) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      select(index + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      select(index - 1);
    }
  };

  return (
    <div class="mode-switch inked" role="radiogroup" aria-label={dict.modes.label}>
      {MODES.map((value, index) => {
        const checked = value === mode;
        const label = value === 'off-the-cuff' ? dict.modes.offTheCuff : dict.modes.deepResearch;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            onClick={() => change(value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span class="switch-label">
              {label}
              {checked && <span class="switch-ink mode-ink" aria-hidden="true" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
