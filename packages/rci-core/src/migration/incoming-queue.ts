import { compareMacroHours } from '@web-three-city/simulation-core';
import { compareStableId } from '../contracts/ids.js';
import type { IncomingHouseholdRequest } from '../contracts/records.js';

export function orderIncomingHouseholdRequests(
  requests: readonly IncomingHouseholdRequest[],
): readonly IncomingHouseholdRequest[] {
  return Object.freeze(
    [...requests].sort(
      (a, b) =>
        b.queuePriority - a.queuePriority ||
        compareMacroHours(a.requestedAtMacroHourIndex, b.requestedAtMacroHourIndex) ||
        a.deterministicSequence - b.deterministicSequence ||
        compareStableId(a.requestId, b.requestId),
    ),
  );
}
