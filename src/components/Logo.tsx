import '../styles/logo.css';

/** What the app is doing right now; drives the marks inside the speech bubble. */
export type LogoState = 'idle' | 'spinning' | 'research' | 'ready' | 'speech' | 'done';

interface Props {
  state: LogoState;
  /** `onDark` flips the colours for the cobalt/coral timer screen. */
  variant?: 'onLight' | 'onDark';
  size?: number;
}

const BUBBLE = '0,0 92,0 92,70 40,70 14,94 14,70 0,70';
const MARK_X = [22, 46, 70] as const;

/**
 * The İrticalen mark: a sharp-cornered speech bubble whose contents follow the session.
 * idle → three tile diamonds · spinning → diamonds hop in turn · research → diamonds "think"
 * ready → diamonds lit · speech → diamonds become moving sound bars · done → solid bar.
 * Purely decorative (the brand name next to it carries the accessible name).
 */
export function Logo({ state, variant = 'onLight', size = 34 }: Props) {
  return (
    <svg
      class={`logo logo-${variant}`}
      data-state={state}
      viewBox="0 0 100 102"
      width={size}
      height={size * 1.02}
      aria-hidden="true"
      focusable="false"
    >
      <polygon class="logo-bubble" points={BUBBLE} />
      {state === 'speech' ? (
        MARK_X.map((x, i) => (
          <rect key={`bar-${x}`} class={`logo-bar logo-bar-${i}`} x={x - 6} y={15} width={12} height={40} />
        ))
      ) : state === 'done' ? (
        <rect class="logo-done" x={14} y={28} width={64} height={14} />
      ) : (
        MARK_X.map((x, i) => (
          <polygon
            key={`diamond-${x}`}
            class={`logo-diamond logo-diamond-${i}`}
            points={`${x},25 ${x + 10},35 ${x},45 ${x - 10},35`}
          />
        ))
      )}
    </svg>
  );
}
