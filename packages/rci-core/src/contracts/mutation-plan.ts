import type { RciContractErrorCode } from './errors.js';
import type { RciSnapshot } from '../rci-snapshot.js';

export interface RciRecordMutationPlan {
  readonly baseRciRevision: number;
  readonly proposedSnapshot: RciSnapshot;
  readonly valid: boolean;
  readonly invalidReason: RciContractErrorCode | null;
}

export function invalidRecordMutationPlan(
  snapshot: RciSnapshot,
  invalidReason: RciContractErrorCode,
): RciRecordMutationPlan {
  return Object.freeze({
    baseRciRevision: snapshot.revision,
    proposedSnapshot: snapshot,
    valid: false,
    invalidReason,
  });
}

export function validRecordMutationPlan(
  base: RciSnapshot,
  proposedSnapshot: RciSnapshot,
): RciRecordMutationPlan {
  return Object.freeze({
    baseRciRevision: base.revision,
    proposedSnapshot,
    valid: true,
    invalidReason: null,
  });
}
