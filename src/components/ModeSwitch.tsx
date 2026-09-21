import { useRef } from 'preact/hooks';
import type { Mode } from '../lib/types';
import type { Dictionary } from '../i18n';

interface Props {
  mode: Mode;
  disabled: boolean;
  dict: Dictionary;
  onChange: (mode: Mode) => void;
}

const MODES: Mode[] = ['off-the-cuff', 'deep-research'];

/** Two-way mode switch: WAI-ARIA radiogroup with roving tabindex and arrow-key navigation. */
export function ModeSwitch({ mode, disabled, dict, onChange }: Props) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number): void => {
    const next = MODES[(index + MODES.length) % MODES.length];
    onChange(next);
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
    <div class="mode-switch" role="radiogroup" aria-label={dict.modes.label}>
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
            onClick={() => onChange(value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
