import { describe, expect, it } from 'vitest';
import { RICH_VIEW_MIN_WIDTH } from '../view';

describe('RICH_VIEW_MIN_WIDTH', () => {
  it('zengin görünümün başladığı genişliği tanımlar', () => {
    expect(RICH_VIEW_MIN_WIDTH).toBe(1100);
  });
});
