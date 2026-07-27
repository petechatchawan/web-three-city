import { describe, expect, it } from 'vitest';
import { classifyTerrainShape } from '../src/shape-classifier.js';

describe('terrain shape classification', () => {
  it.each([
    [{ nw: 0, ne: 0, sw: 0, se: 0 }, 'flat'],
    [{ nw: 1, ne: 1, sw: 0, se: 0 }, 'ramp-north'],
    [{ nw: 0, ne: 0, sw: 1, se: 1 }, 'ramp-south'],
    [{ nw: 0, ne: 1, sw: 0, se: 1 }, 'ramp-east'],
    [{ nw: 1, ne: 0, sw: 1, se: 0 }, 'ramp-west'],
    [{ nw: 1, ne: 0, sw: 0, se: 0 }, 'single-corner-high-nw'],
    [{ nw: 0, ne: 1, sw: 1, se: 1 }, 'single-corner-low-nw'],
    [{ nw: 1, ne: 0, sw: 0, se: 1 }, 'diagonal-ridge'],
    [{ nw: 0, ne: 1, sw: 1, se: 0 }, 'diagonal-valley'],
  ] as const)('classifies %o as %s', (corners, expected) => {
    expect(classifyTerrainShape(corners)).toBe(expected);
  });

  it('is invariant under base-height translation', () => {
    expect(classifyTerrainShape({ nw: 3, ne: 3, sw: 2, se: 2 })).toBe('ramp-north');
  });

  it('classifies ranges above one as severe delta', () => {
    expect(classifyTerrainShape({ nw: 2, ne: 0, sw: 0, se: 2 })).toBe('severe-delta');
  });
});
