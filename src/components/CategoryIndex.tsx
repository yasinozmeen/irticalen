import type { Category } from '../lib/types';

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
 */
export function CategoryIndex({ title, categories, value, disabled, locale, onChange }: Props) {
  return (
    <nav aria-label={title}>
      <p class="index-title">{title}</p>
      <ul class="index-list" role="listbox" aria-label={title}>
        {categories.map((category) => {
          const selected = category.id === value;
          const samples = selected ? category.topics.slice(0, SAMPLE_COUNT) : [];
          return (
            <li key={category.id}>
              <button
                type="button"
                class="index-link"
                role="option"
                aria-selected={selected}
                disabled={disabled}
                onClick={() => onChange(category.id)}
              >
                {category.label}
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
