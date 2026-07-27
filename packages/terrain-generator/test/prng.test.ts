import { describe, expect, it } from 'vitest';
import { Xoshiro128StarStar } from '../src/prng.js';

describe('Xoshiro128StarStar', () => {
  it('expands the curated seed into the locked state vector', () => {
    expect(Xoshiro128StarStar.initialState(1464156977)).toEqual([
      255867800, 3128131530, 524467404, 294713318,
    ]);
  });

  it('produces the exact cross-runtime sequence', () => {
    const rng = Xoshiro128StarStar.fromSeed(1464156977);

    expect(Array.from({ length: 10 }, () => rng.nextUint32())).toEqual([
      649806818, 73000058, 692524748, 1076210427, 405454374, 760682335, 4239989478, 2908641902,
      2471686944, 4189602194,
    ]);
  });

  it('supports seed zero and returns floats in [0,1)', () => {
    const rng = Xoshiro128StarStar.fromSeed(0);
    const value = rng.nextFloat();

    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
