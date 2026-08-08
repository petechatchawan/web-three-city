import { describe, expect, it } from 'vitest';
import * as economy from '../src/index.js';

describe('Economy tax-pressure projection', () => {
  const rules = economy.FOUNDATION_ECONOMY_RULES;

  it('maps neutral, lower, and higher channel rates with stable IDs and ordering', () => {
    expect(
      economy.createTaxPressureProjection(
        { residentialBp: 700, commercialBp: 200, industrialBp: 1_200 },
        rules,
      ),
    ).toEqual({
      ok: true,
      factors: [
        {
          id: 'economy.tax.commercial.v1',
          channel: 'commercial',
          pressureMilli: 25_000,
          weightMilli: 250,
        },
        {
          id: 'economy.tax.industrial.v1',
          channel: 'industrial',
          pressureMilli: -25_000,
          weightMilli: 250,
        },
        {
          id: 'economy.tax.residential.v1',
          channel: 'residential',
          pressureMilli: 0,
          weightMilli: 250,
        },
      ],
    });
  });

  it('clamps at ±100,000 and rounds deterministic integer halves away from zero', () => {
    const narrow = { ...rules, taxPressureFullSpanBp: 3 };
    expect(
      economy.createTaxPressureProjection(
        { residentialBp: 698, commercialBp: 702, industrialBp: 2_000 },
        narrow,
      ),
    ).toMatchObject({
      ok: true,
      factors: [{ pressureMilli: -66_667 }, { pressureMilli: -100_000 }, { pressureMilli: 66_667 }],
    });
  });

  it('rejects invalid rules and policies rather than trusting typed input', () => {
    expect(
      economy.createTaxPressureProjection(
        { residentialBp: 700, commercialBp: 700, industrialBp: 700 },
        { ...rules, taxPressureFullSpanBp: 0 },
      ),
    ).toEqual({ ok: false, reason: 'invalid-rules' });
    expect(
      economy.createTaxPressureProjection(
        { residentialBp: 700.5, commercialBp: 700, industrialBp: 700 },
        rules,
      ),
    ).toEqual({ ok: false, reason: 'invalid-policy' });
  });
});
