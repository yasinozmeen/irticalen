/** Research is split into ordered stages: gather the five things, shape them into the outline, warm up out loud. */
export type ResearchStage = 'gather' | 'shape' | 'warm';

export interface ResearchStagePlan {
  stage: ResearchStage;
  /** Elapsed second at which this stage begins (the first stage always starts at 0). */
  startSec: number;
}

/** Below this total the warm-up stage is dropped. */
const WARM_MIN_TOTAL_SEC = 180;
const WARM_SHARE = 0.1;
const WARM_MIN_SEC = 30;
const WARM_MAX_SEC = 120;
const SHAPE_SHARE = 0.2;
const SHAPE_MIN_SEC = 30;
const SHAPE_MAX_SEC = 300;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * Splits a research duration into stages. Roughly 70% gather / 20% shape / 10% warm, with floors
 * (a stage shorter than 30 s is useless) and caps (a long research only needs "the last few
 * minutes" to shape, not a fifth of an hour). Under 3 minutes there is no warm-up.
 */
export function planResearchStages(totalSec: number): ResearchStagePlan[] {
  const total = Math.max(0, Math.round(totalSec));
  const warm = total >= WARM_MIN_TOTAL_SEC ? Math.round(clamp(total * WARM_SHARE, WARM_MIN_SEC, WARM_MAX_SEC)) : 0;
  const shape = Math.round(clamp(total * SHAPE_SHARE, SHAPE_MIN_SEC, SHAPE_MAX_SEC));
  // Very short totals: gather keeps at least half the time.
  const shapeSec = Math.min(shape, Math.floor(total / 2));
  const plan: ResearchStagePlan[] = [
    { stage: 'gather', startSec: 0 },
    { stage: 'shape', startSec: total - warm - shapeSec },
  ];
  if (warm > 0) plan.push({ stage: 'warm', startSec: total - warm });
  return plan;
}

/** Index (into the plan) of the stage the elapsed time falls in. */
export function researchStageAt(plan: ResearchStagePlan[], elapsedSec: number): number {
  let index = 0;
  for (let i = 0; i < plan.length; i += 1) {
    if (elapsedSec >= plan[i].startSec) index = i;
  }
  return index;
}
