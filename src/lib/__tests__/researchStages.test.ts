import { describe, expect, it } from 'vitest';
import { planResearchStages, researchStageAt } from '../researchStages';

const starts = (totalSec: number) => planResearchStages(totalSec).map((p) => `${p.stage}@${p.startSec}`);

describe('planResearchStages', () => {
  it('10 dk: 7 dk topla, 2 dk kur, 1 dk ısın', () => {
    expect(starts(600)).toEqual(['gather@0', 'shape@420', 'warm@540']);
  });

  it('3 dk altında ısınma yok; 1 dk: son 30 sn kur', () => {
    expect(starts(60)).toEqual(['gather@0', 'shape@30']);
    expect(starts(120)).toEqual(['gather@0', 'shape@90']);
    expect(starts(179)).toEqual(['gather@0', 'shape@143']);
  });

  it('3 dk: ısınma en az 30 sn', () => {
    expect(starts(180)).toEqual(['gather@0', 'shape@114', 'warm@150']);
  });

  it('uzun araştırmada kur 5 dk, ısın 2 dk ile sınırlı', () => {
    expect(starts(3600)).toEqual(['gather@0', 'shape@3180', 'warm@3480']);
  });

  it('her süre için bölümler sıralı ve toplamın içinde; topla en az yarı', () => {
    for (let min = 1; min <= 60; min += 1) {
      const total = min * 60;
      const plan = planResearchStages(total);
      expect(plan[0]).toEqual({ stage: 'gather', startSec: 0 });
      expect(plan[1].startSec).toBeGreaterThanOrEqual(total / 2);
      for (let i = 1; i < plan.length; i += 1) {
        expect(plan[i].startSec).toBeGreaterThan(plan[i - 1].startSec);
        expect(plan[i].startSec).toBeLessThan(total);
      }
    }
  });
});

describe('researchStageAt', () => {
  const plan = planResearchStages(600);
  it('geçen süreye göre bölümü verir', () => {
    expect(researchStageAt(plan, 0)).toBe(0);
    expect(researchStageAt(plan, 419)).toBe(0);
    expect(researchStageAt(plan, 420)).toBe(1);
    expect(researchStageAt(plan, 540)).toBe(2);
    expect(researchStageAt(plan, 9999)).toBe(2);
  });
});
