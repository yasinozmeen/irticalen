import { useEffect, useRef, useState } from 'preact/hooks';
import type { Dictionary, Locale } from '../i18n';
import { useFocusTrap } from './useFocusTrap';

interface Props {
  locale: Locale;
  dict: Dictionary;
}

/**
 * Bottom dock (always visible on the frameless home screens) + the "irticalen ne demek?" sheet
 * it opens. A standalone island (not part of the main App island) so it can hydrate independently
 * — but it still participates in App's `[data-outside-app]` inert mechanism (see App.tsx) by
 * carrying that same data attribute on the dock `<nav>`, and the sheet uses the shared
 * `useFocusTrap` hook exactly like the timer/settings dialogs.
 *
 * The sheet's content (dictionary entry + about paragraphs) is always rendered — only its
 * visibility is toggled via the `hidden` attribute — so the text is present in the static,
 * server-rendered HTML for SEO even though the dialog starts closed.
 */
export function Dock({ locale, dict }: Props) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // While the sheet is open nothing behind it may be reachable — not by Tab, not by a screen
  // reader's virtual cursor. App does the same for its own dialogs (see App.tsx); it cannot change
  // state while inert, so the two never fight over the attribute.
  // Declared before useFocusTrap on purpose: cleanups run in hook order, so the dock is interactive
  // again by the time the trap hands focus back to the trigger button.
  useEffect(() => {
    if (!open) return;
    const behind = document.querySelectorAll<HTMLElement>('.app-shell, [data-outside-app]');
    behind.forEach((el) => {
      el.inert = true;
    });
    return () => {
      behind.forEach((el) => {
        el.inert = false;
      });
    };
  }, [open]);

  useFocusTrap(open, sheetRef, () => setOpen(false));

  const whyPath = locale === 'tr' ? '/neden/' : '/en/why/';

  return (
    <>
      <nav class="dock" aria-label={dict.footer.linksHeading} data-outside-app>
        <div class="dock-group">
          <button
            type="button"
            class="dock-link"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <span class="dock-long">{dict.footer.wordHeading}</span>
            <span class="dock-short">{dict.footer.wordShort}</span>
          </button>
          <a class="dock-link" href={whyPath}>
            <span class="dock-long">{dict.footer.why}</span>
            <span class="dock-short">{dict.footer.whyShort}</span>
          </a>
        </div>
        <div class="dock-group">
          <a class="dock-link dock-projects" href="https://yasinozmeen.me" target="_blank" rel="noopener">
            {dict.footer.projects}
          </a>
          <a class="dock-ico" href="https://x.com/yasinozmeen" target="_blank" rel="me noopener" aria-label="X">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
            </svg>
          </a>
          <a class="dock-ico" href="https://github.com/yasinozmeen/irticalen" rel="noopener" aria-label="GitHub">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.7.5.7 5.5.7 11.8c0 5 3.2 9.2 7.7 10.7.6.1.8-.2.8-.5v-2c-3.1.7-3.8-1.3-3.8-1.3-.5-1.3-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.7 2.6 1.2 3.3.9.1-.7.4-1.2.7-1.5-2.5-.3-5.1-1.2-5.1-5.5 0-1.2.4-2.2 1.2-3-.1-.3-.5-1.5.1-3 0 0 1-.3 3.1 1.2a10.8 10.8 0 0 1 5.7 0c2.2-1.5 3.1-1.2 3.1-1.2.6 1.5.2 2.7.1 3 .8.8 1.2 1.8 1.2 3 0 4.3-2.6 5.2-5.1 5.5.4.4.8 1 .8 2.1v3.1c0 .3.2.7.8.5 4.5-1.5 7.7-5.7 7.7-10.7C23.3 5.5 18.3.5 12 .5z" />
            </svg>
          </a>
          <a
            class="dock-ico"
            href="https://buymeacoffee.com/yasinozmeen"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={dict.about.coffee}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" aria-hidden="true">
              <path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 5h-2M8 3v3M12 3v3" />
            </svg>
          </a>
        </div>
      </nav>

      <div
        ref={sheetRef}
        class="sheet"
        hidden={!open}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <div
          class="sheet-page"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-term"
          tabIndex={-1}
          data-autofocus
        >
          <p class="sheet-term" id="sheet-term">
            {dict.about.word.term}
            <i>.</i> <span>{dict.about.word.pronunciation}</span>
          </p>
          <p class="sheet-kind">{dict.about.word.kind}</p>
          <p class="sheet-def">{dict.about.word.definition}</p>
          <p class="sheet-ex">{dict.about.word.example}</p>
          <div class="sheet-body">
            {dict.about.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <p class="sheet-kind">{dict.about.inspiredBy}</p>
          <p class="sheet-actions">
            <a class="dock-link" href="https://yasinozmeen.me" target="_blank" rel="noopener">
              {dict.footer.projects}
            </a>
            <a class="dock-link" href={whyPath}>
              {dict.footer.why}
            </a>
            <button type="button" class="dock-link" onClick={() => setOpen(false)}>
              {dict.footer.close}
            </button>
          </p>
        </div>
      </div>
    </>
  );
}
