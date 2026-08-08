import type { BasisPoints } from './money.js';
import type { EconomyRulesV1 } from './rules.js';
import { validateEconomyRules } from './rules.js';

export type EconomyTaxChannel = 'residential' | 'commercial' | 'industrial';
export interface EconomyTaxPressureFactor {
  readonly id: `economy.tax.${EconomyTaxChannel}.v1`;
  readonly channel: EconomyTaxChannel;
  readonly pressureMilli: number;
  readonly weightMilli: number;
}

export type TaxPressureProjectionResult =
  | Readonly<{ ok: true; factors: readonly EconomyTaxPressureFactor[] }>
  | Readonly<{ ok: false; reason: 'invalid-rules' | 'invalid-policy' }>;

const roundRatio = (numerator: bigint, denominator: bigint): bigint => {
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
};

export function createTaxPressureProjection(
  policy: Readonly<{
    residentialBp: BasisPoints;
    commercialBp: BasisPoints;
    industrialBp: BasisPoints;
  }>,
  rules: EconomyRulesV1,
): TaxPressureProjectionResult {
  if (!validateEconomyRules(rules)) return { ok: false, reason: 'invalid-rules' };
  const channels = ['commercial', 'industrial', 'residential'] as const;
  if (
    !channels.every((channel) => {
      const rate = policy[`${channel}Bp`];
      return (
        Number.isSafeInteger(rate) &&
        rate >= rules.minimumTaxRateBp &&
        rate <= rules.maximumTaxRateBp
      );
    })
  )
    return { ok: false, reason: 'invalid-policy' };

  return {
    ok: true,
    factors: Object.freeze(
      channels.map((channel) => {
        const difference = BigInt(rules.neutralTaxRateBp - policy[`${channel}Bp`]);
        const raw = roundRatio(difference * 100_000n, BigInt(rules.taxPressureFullSpanBp));
        return Object.freeze({
          id: `economy.tax.${channel}.v1` as const,
          channel,
          pressureMilli: Number(raw < -100_000n ? -100_000n : raw > 100_000n ? 100_000n : raw),
          weightMilli: rules.rciTaxFactorWeightMilli,
        });
      }),
    ),
  };
}
