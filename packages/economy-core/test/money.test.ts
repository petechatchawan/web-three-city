import { describe, expect, it } from 'vitest';
import * as economy from '../src/index.js';

describe('authoritative money arithmetic', () => {
  it('exposes safe-integer money validation', () => {
    expect(economy).toHaveProperty('isMoneyMinor');
    expect(economy.isMoneyMinor(0)).toBe(true);
    expect(economy.isMoneyMinor(-1)).toBe(true);
    expect(economy.isMoneyMinor(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(economy.isMoneyMinor(0.5)).toBe(false);
    expect(economy.isMoneyMinor(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(economy.isMoneyMinor(Number.NaN)).toBe(false);
    expect(economy.isMoneyMinor('100')).toBe(false);
  });

  it('exposes basis-point validation and checked ratio arithmetic', () => {
    expect(economy).toHaveProperty('isBasisPoints');
    expect(economy).toHaveProperty('multiplyRatio');
  });

  it('accepts only integer basis points in the percentage range', () => {
    expect(economy.isBasisPoints(0)).toBe(true);
    expect(economy.isBasisPoints(10_000)).toBe(true);
    expect(economy.isBasisPoints(-1)).toBe(false);
    expect(economy.isBasisPoints(10_001)).toBe(false);
    expect(economy.isBasisPoints(700.5)).toBe(false);
  });

  it('multiplies before dividing and rounds halves away from zero', () => {
    expect(economy.multiplyRatio(101, 500, 10_000)).toEqual({ ok: true, value: 5 });
    expect(economy.multiplyRatio(110, 500, 10_000)).toEqual({ ok: true, value: 6 });
    expect(economy.multiplyRatio(-110, 500, 10_000)).toEqual({ ok: true, value: -6 });
  });

  it('rejects invalid inputs and safe-integer overflow', () => {
    expect(economy.multiplyRatio(1.5, 1, 1)).toEqual({
      ok: false,
      reason: 'invalid-input',
    });
    expect(economy.multiplyRatio(1, 1, 0)).toEqual({
      ok: false,
      reason: 'invalid-divisor',
    });
    expect(economy.multiplyRatio(Number.MAX_SAFE_INTEGER, 2, 1)).toEqual({
      ok: false,
      reason: 'overflow',
    });
  });
});
