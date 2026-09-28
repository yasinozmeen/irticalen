import { useMemo } from 'preact/hooks';
import { Sheet } from './Sheet';
import { buildCalendar, currentStreak, longestStreak, type DayLog } from '../lib/streak';
import { fill, type Dictionary, type Locale } from '../i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  dict: Dictionary;
  locale: Locale;
  days: DayLog;
}

function markLabel(dict: Dictionary, mark: number): string {
  if (mark === 3) return dict.streak.markBoth;
  if (mark === 2) return dict.streak.markResearch;
  if (mark === 1) return dict.streak.markOff;
  return dict.streak.markNone;
}

/** The "serin" sheet: same kâğıt sheet shell as "irticalen ne demek?", opened from the top-bar streak
 * indicator (see App.tsx). Content only — `Sheet` owns the focus trap, inert-while-open and the
 * backdrop click. */
export function StreakSheet({ open, onClose, dict, locale, days }: Props) {
  // Read once per opening — the sheet does not need to tick over a live midnight while shown.
  const now = useMemo(() => new Date(), [open]);
  const weeks = useMemo(() => buildCalendar(days, now), [days, now]);
  const streak = currentStreak(days, now);
  const longest = longestStreak(days);
  const total = Object.keys(days).length;
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'tr' ? 'tr' : 'en', { day: 'numeric', month: 'long' }),
    [locale],
  );

  const titleText =
    streak > 0 ? fill(streak === 1 ? dict.streak.dayOne : dict.streak.dayOther, { n: streak }) : dict.streak.startToday;

  return (
    <Sheet open={open} onClose={onClose} labelledBy="streak-term" autoFocusSelf>
      <p class="sheet-kind">{dict.streak.eyebrow}</p>
      <p class="sheet-term" id="streak-term">
        {titleText}
        <i>.</i>
      </p>
      <p class="streak-summary">{fill(dict.streak.summary, { m: longest, k: total })}</p>

      <div class="streak-calendar-wrap">
        <div class="streak-cal-head" aria-hidden="true">
          {dict.streak.weekdays.map((letter, index) => (
            <span key={index}>{letter}</span>
          ))}
        </div>
        <div class="streak-calendar">
          {weeks.flatMap((week) =>
            week.map((day) => {
              const [y, m, d] = day.key.split('-').map(Number);
              if (day.isFuture) {
                return (
                  <div key={day.key} class="streak-cell" data-future="" aria-hidden="true">
                    {d}
                  </div>
                );
              }
              const date = new Date(y, m - 1, d);
              const label = fill(dict.streak.cellAria, {
                date: dateFormatter.format(date),
                mark: markLabel(dict, day.mark),
              });
              const fullLabel = day.isToday ? `${label} · ${dict.streak.today}` : label;
              return (
                <div
                  key={day.key}
                  class="streak-cell"
                  data-mark={day.mark}
                  data-today={day.isToday ? '' : undefined}
                  role="img"
                  aria-label={fullLabel}
                >
                  <span aria-hidden="true">{d}</span>
                </div>
              );
            }),
          )}
        </div>
      </div>

      <p class="streak-legend">{dict.streak.legend}</p>
      <p class="streak-note">{dict.streak.note}</p>

      <p class="sheet-actions">
        <button type="button" class="dock-link" onClick={onClose}>
          {dict.footer.close}
        </button>
      </p>
    </Sheet>
  );
}
