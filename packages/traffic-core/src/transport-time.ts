import { assertTrafficSafeInteger } from './contracts.js';
import { TrafficContractError } from './errors.js';

export const TRAFFIC_TEMPORAL_POLICY_VERSION = 1 as const;
export const TRAFFIC_TRANSPORT_QUANTA_PER_GAME_MINUTE = 4 as const;

export interface TrafficTimeCursor {
  readonly sourceGameMinute: number;
  readonly completedTransportQuantaWithinMinute: number;
  readonly absoluteTransportSecond: number;
  readonly temporalPolicyVersion: number;
}

export function createTrafficTimeCursor(input: TrafficTimeCursor): TrafficTimeCursor {
  assertTrafficSafeInteger(input.sourceGameMinute);
  assertTrafficSafeInteger(input.completedTransportQuantaWithinMinute);
  assertTrafficSafeInteger(input.absoluteTransportSecond);
  if (
    input.temporalPolicyVersion !== TRAFFIC_TEMPORAL_POLICY_VERSION ||
    input.completedTransportQuantaWithinMinute > TRAFFIC_TRANSPORT_QUANTA_PER_GAME_MINUTE ||
    input.absoluteTransportSecond !==
      input.sourceGameMinute * TRAFFIC_TRANSPORT_QUANTA_PER_GAME_MINUTE +
        input.completedTransportQuantaWithinMinute
  ) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  return Object.freeze({ ...input });
}

export function advanceTrafficTimeCursor(cursor: TrafficTimeCursor): TrafficTimeCursor {
  const canonical = createTrafficTimeCursor(cursor);
  if (canonical.completedTransportQuantaWithinMinute >= TRAFFIC_TRANSPORT_QUANTA_PER_GAME_MINUTE) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  return createTrafficTimeCursor({
    ...canonical,
    completedTransportQuantaWithinMinute: canonical.completedTransportQuantaWithinMinute + 1,
    absoluteTransportSecond: canonical.absoluteTransportSecond + 1,
  });
}
