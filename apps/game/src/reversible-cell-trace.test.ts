import { describe, expect, it } from 'vitest';
import { createReversibleCellTrace } from './reversible-cell-trace.js';

describe('ReversibleCellTrace', () => {
  it('rasterizes fast movement and removes the exact reverse tail', () => {
    const trace = createReversibleCellTrace({ x: 1, z: 1 });
    expect(trace.extendTo({ x: 4, z: 1 })).toBe(true);
    expect(trace.cells()).toEqual([
      { x: 1, z: 1 },
      { x: 2, z: 1 },
      { x: 3, z: 1 },
      { x: 4, z: 1 },
    ]);

    expect(trace.extendTo({ x: 2, z: 1 })).toBe(true);
    expect(trace.cells()).toEqual([
      { x: 1, z: 1 },
      { x: 2, z: 1 },
    ]);
  });

  it('branches from the retained tail without restoring the abandoned branch', () => {
    const trace = createReversibleCellTrace({ x: 1, z: 1 });
    trace.extendTo({ x: 4, z: 1 });
    trace.extendTo({ x: 2, z: 1 });
    trace.extendTo({ x: 2, z: 3 });

    expect(trace.cells()).toEqual([
      { x: 1, z: 1 },
      { x: 2, z: 1 },
      { x: 2, z: 2 },
      { x: 2, z: 3 },
    ]);
  });

  it('ignores repeated tail jitter and returns defensive cell copies', () => {
    const trace = createReversibleCellTrace({ x: 3, z: 3 });
    expect(trace.extendTo({ x: 3, z: 3 })).toBe(false);
    const exposed = trace.cells();
    (exposed[0] as { x: number }).x = 99;
    expect(trace.cells()).toEqual([{ x: 3, z: 3 }]);
  });

  it('preserves older visited cells when loops revisit a non-tail location', () => {
    const trace = createReversibleCellTrace({ x: 1, z: 1 });
    trace.extendTo({ x: 3, z: 1 });
    trace.extendTo({ x: 3, z: 3 });
    trace.extendTo({ x: 1, z: 3 });
    trace.extendTo({ x: 1, z: 1 });
    trace.extendTo({ x: 1, z: 3 });

    expect(trace.cells()).toEqual([
      { x: 1, z: 1 },
      { x: 2, z: 1 },
      { x: 3, z: 1 },
      { x: 3, z: 2 },
      { x: 1, z: 3 },
      { x: 2, z: 3 },
      { x: 3, z: 3 },
    ]);
  });
});
