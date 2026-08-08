export type MoneyMinor = number;
export type BasisPoints = number;

export type RatioResult =
  | { readonly ok: true; readonly value: number }
  | {
      readonly ok: false;
      readonly reason: 'invalid-input' | 'invalid-divisor' | 'overflow';
    };

export const isMoneyMinor = (value: unknown): value is MoneyMinor =>
  typeof value === 'number' && Number.isSafeInteger(value);

export const isBasisPoints = (value: unknown): value is BasisPoints =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 10_000;

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);

export const multiplyRatio = (value: number, multiplier: number, divisor: number): RatioResult => {
  if (!Number.isSafeInteger(value) || !Number.isSafeInteger(multiplier)) {
    return { ok: false, reason: 'invalid-input' };
  }
  if (!Number.isSafeInteger(divisor) || divisor <= 0) {
    return { ok: false, reason: 'invalid-divisor' };
  }

  const product = BigInt(value) * BigInt(multiplier);
  const productSign = product < 0n ? -1n : 1n;
  const absoluteProduct = product < 0n ? -product : product;
  const bigDivisor = BigInt(divisor);
  const quotient = absoluteProduct / bigDivisor;
  const remainder = absoluteProduct % bigDivisor;
  const roundedAbsolute = remainder * 2n >= bigDivisor ? quotient + 1n : quotient;
  const rounded = roundedAbsolute * productSign;

  if (rounded > MAX_SAFE_INTEGER_BIGINT || rounded < MIN_SAFE_INTEGER_BIGINT) {
    return { ok: false, reason: 'overflow' };
  }
  return { ok: true, value: Number(rounded) };
};
