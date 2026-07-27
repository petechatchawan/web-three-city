import { describe, expect, it } from 'vitest';
import { projectCardinalConstraints } from '../src/constraint-projection.js';

describe('cardinal constraint projection', () => {
  it('lowers only the higher endpoint until every delta is at most one', () => {
    const result = projectCardinalConstraints(new Uint8Array([0, 4, 0, 0]), 2, 2, 16);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(new Uint8Array([0, 1, 0, 0]));
  });

  it('is deterministic and leaves valid input unchanged', () => {
    const input = new Uint8Array([1, 2, 2, 1]);
    const result = projectCardinalConstraints(input, 2, 2, 16);

    expect(result).toEqual({ ok: true, value: input });
  });
});
