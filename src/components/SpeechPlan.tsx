import { fill, type Dictionary } from '../i18n';
import type { Mode } from '../lib/types';
import type { ResearchStageMinutes } from '../lib/researchStages';

interface Props {
  mode: Mode;
  dict: Dictionary;
  /** Only used in deep-research mode — the research duration already split into stages+minutes. */
  researchStages: ResearchStageMinutes[];
  speechMinutes: number;
}

const STAGE_INDEX: Record<ResearchStageMinutes['stage'], number> = { gather: 0, shape: 1, warm: 2 };

/**
 * Rich view only: the speech outline (and, in deep-research mode, the research stages before it)
 * shown above the action row, before the timer ever opens — so the visitor sees how their time is
 * about to be spent. Reuses the same wording as the timer overlay's own outline/stage labels
 * (`dict.timer.arc` / `dict.timer.stages`) so the two never drift apart.
 */
export function SpeechPlan({ mode, dict, researchStages, speechMinutes }: Props) {
  const speechValueText = fill(dict.settings.minutes, { min: speechMinutes });

  if (mode === 'off-the-cuff') {
    return (
      <div class="plan">
        <span class="plan-when">{dict.plan.stuck}</span>
        <ol class="plan-steps">
          {dict.timer.arc.map((step, index) => (
            <li key={step}>
              <span class="n">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const lastStepIndex = dict.timer.arc.length - 1;

  return (
    <div class="plan">
      <span class="plan-when">{dict.plan.before}</span>
      <ol class="plan-steps">
        {researchStages.map((entry, index) => (
          <li key={entry.stage}>
            <span class="n">{index + 1}</span>
            {dict.timer.stages[STAGE_INDEX[entry.stage]]}
            <span class="min">{fill(dict.settings.minutes, { min: entry.minutes })}</span>
          </li>
        ))}
      </ol>
      <span class="plan-when">{dict.plan.after}</span>
      <ol class="plan-steps">
        {dict.timer.arc.map((step, index) => (
          <li key={step}>
            <span class="n">{index + 1}</span>
            {step}
            {index === lastStepIndex && <span class="min">{speechValueText}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
