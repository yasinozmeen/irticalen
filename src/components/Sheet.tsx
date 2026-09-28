import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { useFocusTrap } from './useFocusTrap';

interface Props {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  /** When true, the sheet-page container itself is the initial focus target (there is no specific
   * control to jump to). Omit when a child already carries its own `data-autofocus` — e.g. the
   * feedback sheet's textarea — since only the first match in the tree is used. */
  autoFocusSelf?: boolean;
  children: ComponentChildren;
}

/**
 * Shared "kâğıt sayfa" sheet shell — same mechanism/style for every full-page sheet (the about and
 * feedback sheets in Dock, and the streak sheet in App): a focus trap, everything outside made inert
 * while open, and a backdrop click to close. Opening/closing itself (the view transition, and which
 * boolean drives `open`) stays with the caller, same as the timer/settings dialogs.
 */
export function Sheet({ open, onClose, labelledBy, autoFocusSelf, children }: Props) {
  // The trap's root is the outer backdrop (not the sheet-page itself): `useFocusTrap` looks for
  // `[data-autofocus]` among the root's DESCENDANTS, and the sheet-page — the container we actually
  // want focused when no field inside it claims that role — is one such descendant.
  const ref = useRef<HTMLDivElement>(null);

  // While a sheet is open nothing behind it may be reachable — not by Tab, not by a screen reader's
  // virtual cursor. Scoped to a DOM query (not React state) so it works the same regardless of which
  // island (App or Dock) owns the sheet that is currently open.
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

  useFocusTrap(open, ref, onClose);

  return (
    <div
      ref={ref}
      class="sheet"
      hidden={!open}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        class="sheet-page"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        data-autofocus={autoFocusSelf || undefined}
      >
        {children}
      </div>
    </div>
  );
}
