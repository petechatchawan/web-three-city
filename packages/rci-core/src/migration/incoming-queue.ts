import { compareStableId } from '../contracts/ids.js';
import type { IncomingHouseholdRequest } from '../contracts/records.js';

export function orderIncomingHouseholdRequests(
  requests: readonly IncomingHouseholdRequest[],
): readonly IncomingHouseholdRequest[] {
  return Object.freeze(
    [...requests].sort(
      (a, b) =>
        b.queuePriority - a.queuePriority ||
        a.requestedAtTick - b.requestedAtTick ||
        a.deterministicSequence - b.deterministicSequence ||
        compareStableId(a.requestId, b.requestId),
    ),
  );
}
