import type { Category } from '../lib/types';
import { runViewTransition } from '../lib/viewTransition';

/** How many sample topics to show, in lowercase, under the selected category/field. */
const SAMPLE_COUNT = 3;

interface Props {
  /** "kategoriler" (off-the-cuff) or "alanlar" (deep-research) — the small italic caption above the list. */
  title: string;
  categories: Category[];
  value: string;
  disabled: boolean;
  /** Locale-aware lowercasing for the sample topics under the selected item. */
  locale: string;
  onChange: (categoryId: string) => void;
}

/**
 * Rich view's ("açık kitap" / open-book) left-page index: every category/field as an always-open
 * list — replacing the closed CategorySelect dropdown used in the minimalist view. The selected
 * entry shows a few sample topics from its pool underneath, in pencil italics.
 *
 * On a change the old underline is wiped away and the new one is drawn in, pen-like (a bar sliding
 * down the list would cross every word on its way and read as a strike-through), the sample line
 * moves along and the entries in between shift instead of jumping; switching mode (categories ↔ fields) lets the old list sink
 * away and the new one rise in — all through a view transition scoped to `vt-switch`.
 */
export function CategoryIndex({ title, categories, value, disabled, locale, onChange }: Props) {
  const change = (categoryId: string): void => {
    if (categoryId === value) return;
    void runViewTransition(() => onChange(categoryId), undefined, 'switch');
  };

  return (
    <nav aria-label={title}>
      <p class="index-title">{title}</p>
      <ul class="index-list" role="listbox" aria-label={title}>
        {categories.map((category) => {
          const selected = category.id === value;
          const samples = selected ? category.topics.slice(0, SAMPLE_COUNT) : [];
          return (
            <li key={category.id} style={{ '--ix': vtName(category.id), '--ixi': `${vtName(category.id)}-ink` }}>
              <button
                type="button"
                class="index-link inked"
                role="option"
                aria-selected={selected}
                disabled={disabled}
                onClick={() => change(category.id)}
              >
                <span class="switch-label">
                  {category.label}
                  {selected && <span class="switch-ink index-ink" aria-hidden="true" />}
                </span>
              </button>
              {samples.length > 0 && (
                <p class="index-sample">
                  {samples.map((topic) => topic.toLocaleLowerCase(locale)).join(', ')}…
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** A `view-transition-name` for one entry, from its id — ids are plain slugs already, this only
 * guarantees a valid CSS identifier whatever an id contains. */
function vtName(id: string): string {
  return `ix-${id.toLowerCase().replace(/[^a-z0-9-]/g, '_')}`;
}
