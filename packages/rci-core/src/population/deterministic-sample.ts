import { RciContractError } from '../contracts/errors.js';

export type ProbabilityUnit = number;
export const PROBABILITY_SCALE = 1_000_000_000;
export const DETERMINISTIC_SAMPLE_ALGORITHM = 'fnv1a32-null-delimited-v1';

function assertComponent(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RciContractError('rci:invalid-state');
  }
}

export function deterministicSample(input: Readonly<{
  seed: number;
  eventType: string;
  evaluationTick: number;
  entityStableId: string;
  attemptIndex: number;
}>): ProbabilityUnit {
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
  const bytes = new TextEncoder().encode(canonical);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % PROBABILITY_SCALE;
}
