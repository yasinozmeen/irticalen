import type { Dictionary } from '../i18n';
import { fill } from '../i18n';

interface Props {
  topic: string | null;
  spinning: boolean;
  landKey: number;
  dict: Dictionary;
}

/** The topic display: a rotated paper-sheet card, plus a label and an sr-only landing announcement. */
export function TopicReel({ topic, spinning, landKey, dict }: Props) {
  const label = spinning ? dict.reel.spinning : topic ? dict.reel.landed : dict.reel.idle;
  const text = topic ?? dict.reel.empty;
  const classes = [
    'topic-sheet',
    spinning ? 'is-spinning' : '',
    !topic ? 'is-empty' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section class="topic-stage">
      <p class="reel-label">{label}</p>
      <p key={landKey} class={`${classes}${!spinning && topic ? ' is-landed' : ''}`} id="topic-display">
        {text}
      </p>
      <p class="sr-only" aria-live="polite">
        {!spinning && topic ? fill(dict.reel.announce, { topic }) : ''}
      </p>
    </section>
  );
}
