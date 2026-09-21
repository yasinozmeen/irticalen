import { useEffect, useRef, useState } from 'preact/hooks';
import type { Category } from '../lib/types';
import type { Dictionary } from '../i18n';

interface Props {
  categories: Category[];
  value: string;
  disabled: boolean;
  dict: Dictionary;
  onChange: (categoryId: string) => void;
}

/** Category picker following the WAI-ARIA listbox pattern (button + popup listbox). */
export function CategorySelect({ categories, value, disabled, dict, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const selectedIndex = categories.findIndex((category) => category.id === value);
  const selectedLabel = categories[selectedIndex]?.label ?? '';

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    listboxRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const commit = (index: number): void => {
    const category = categories[index];
    if (!category) return;
    onChange(category.id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (event: KeyboardEvent): void => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (event: KeyboardEvent): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => Math.min(categories.length - 1, index + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(categories.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        commit(activeIndex);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const activeId = `category-opt-${categories[activeIndex]?.id ?? ''}`;

  return (
    <div class="category-select" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        class="category-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onTriggerKeyDown}
      >
        <span>{selectedLabel}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
          class="category-listbox"
          aria-label={dict.category.label}
          aria-activedescendant={activeId}
          onKeyDown={onListKeyDown}
        >
          {categories.map((category, index) => (
            <li
              key={category.id}
              id={`category-opt-${category.id}`}
              role="option"
              aria-selected={category.id === value}
              class={`category-option${index === activeIndex ? ' is-active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commit(index)}
            >
              {category.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
