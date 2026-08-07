import { RciContractError } from '../contracts/errors.js';

export type ProbabilityUnit = number;
export const PROBABILITY_SCALE = 1_000_000_000;
export const DETERMINISTIC_SAMPLE_ALGORITHM = 'fnv1a32-null-delimited-v1';

function utf8Bytes(value: string): readonly number[] {
  const bytes: number[] = [];
  for (const symbol of value) {
    let codePoint = symbol.codePointAt(0)!;
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) codePoint = 0xfffd;
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >>> 12),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
}

function assertComponent(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RciContractError('rci:invalid-state');
  }
}

export function deterministicSample(
  input: Readonly<{
    seed: number;
    eventType: string;
    evaluationTick: number;
    entityStableId: string;
    attemptIndex: number;
  }>,
): ProbabilityUnit {
  assertComponent(input.seed);
  assertComponent(input.evaluationTick);
  assertComponent(input.attemptIndex);
  if (input.eventType.length === 0 || input.entityStableId.length === 0) {
    throw new RciContractError('rci:invalid-state');
  }

  const canonical = [
    input.seed,
    input.eventType,
    input.evaluationTick,
    input.entityStableId,
    input.attemptIndex,
  ].join('\0');
  const bytes = utf8Bytes(canonical);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % PROBABILITY_SCALE;
}
