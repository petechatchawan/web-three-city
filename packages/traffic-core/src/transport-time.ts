import { gameMinuteValue, type AbsoluteGameMinute } from '@web-three-city/simulation-core';
import { assertTrafficSafeInteger } from './contracts.js';
import { TrafficContractError } from './errors.js';

export const TRAFFIC_TEMPORAL_POLICY_VERSION = 1 as const;
export const TRANSPORT_QUANTA_PER_GAME_MINUTE = 4 as const;
/** @deprecated Use TRANSPORT_QUANTA_PER_GAME_MINUTE. */
export const TRAFFIC_TRANSPORT_QUANTA_PER_GAME_MINUTE = TRANSPORT_QUANTA_PER_GAME_MINUTE;

declare const absoluteTransportSecondBrand: unique symbol;
declare const transportSecondDurationBrand: unique symbol;

export type AbsoluteTransportSecond = number & {
  readonly [absoluteTransportSecondBrand]: 'AbsoluteTransportSecond';
};

export type TransportSecondDuration = number & {
  readonly [transportSecondDurationBrand]: 'TransportSecondDuration';
};

export interface TrafficTimeCursor {
  readonly sourceGameMinute: AbsoluteGameMinute;
  readonly completedTransportQuantaWithinMinute: number;
  readonly absoluteTransportSecond: AbsoluteTransportSecond;
  readonly temporalPolicyVersion: typeof TRAFFIC_TEMPORAL_POLICY_VERSION;
}

export function absoluteTransportSecond(value: number): AbsoluteTransportSecond {
  assertTrafficSafeInteger(value);
  return value as AbsoluteTransportSecond;
}

export function transportSecondDuration(value: number): TransportSecondDuration {
  assertTrafficSafeInteger(value);
  return value as TransportSecondDuration;
}

export function transportSecondValue(
  value: AbsoluteTransportSecond | TransportSecondDuration,
): number {
  return value;
}

export function transportSecondAtGameMinute(minute: AbsoluteGameMinute): AbsoluteTransportSecond {
  const minuteValue = gameMinuteValue(minute);
  assertTrafficSafeInteger(minuteValue);
  if (minuteValue > Math.floor(Number.MAX_SAFE_INTEGER / TRANSPORT_QUANTA_PER_GAME_MINUTE)) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  return absoluteTransportSecond(minuteValue * TRANSPORT_QUANTA_PER_GAME_MINUTE);
}

export function transportSecondAtLegacyGameSecond(value: number): AbsoluteTransportSecond {
  assertTrafficSafeInteger(value);
  if (value > Math.floor(Number.MAX_SAFE_INTEGER / TRANSPORT_QUANTA_PER_GAME_MINUTE)) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  return absoluteTransportSecond(value * TRANSPORT_QUANTA_PER_GAME_MINUTE);
}

export function legacyGameSecondAtTransportSecond(value: AbsoluteTransportSecond): number {
  const transportValue = transportSecondValue(value);
  assertTrafficSafeInteger(transportValue);
  return Math.floor(transportValue / TRANSPORT_QUANTA_PER_GAME_MINUTE);
}

export function addTransportSeconds(
  point: AbsoluteTransportSecond,
  duration: TransportSecondDuration,
): AbsoluteTransportSecond {
  const pointValue = transportSecondValue(point);
  const durationValue = transportSecondValue(duration);
  if (pointValue > Number.MAX_SAFE_INTEGER - durationValue) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  return absoluteTransportSecond(pointValue + durationValue);
}

export function subtractTransportSeconds(
  point: AbsoluteTransportSecond,
  duration: TransportSecondDuration,
): AbsoluteTransportSecond {
  const pointValue = transportSecondValue(point);
  const durationValue = transportSecondValue(duration);
  if (durationValue > pointValue) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  return absoluteTransportSecond(pointValue - durationValue);
}

export function compareTransportSeconds(
  first: AbsoluteTransportSecond,
  second: AbsoluteTransportSecond,
): -1 | 0 | 1 {
  const firstValue = transportSecondValue(first);
  const secondValue = transportSecondValue(second);
  return firstValue < secondValue ? -1 : firstValue > secondValue ? 1 : 0;
}

export function transportSecondDurationBetween(
  later: AbsoluteTransportSecond,
  earlier: AbsoluteTransportSecond,
): TransportSecondDuration {
  const laterValue = transportSecondValue(later);
  const earlierValue = transportSecondValue(earlier);
  if (laterValue < earlierValue) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  return transportSecondDuration(laterValue - earlierValue);
}

export function createTrafficTimeCursor(input: TrafficTimeCursor): TrafficTimeCursor {
  assertTrafficSafeInteger(input.sourceGameMinute);
  assertTrafficSafeInteger(input.completedTransportQuantaWithinMinute);
  assertTrafficSafeInteger(input.absoluteTransportSecond);
  const expectedTransportSecond = addTransportSeconds(
    transportSecondAtGameMinute(input.sourceGameMinute),
    transportSecondDuration(input.completedTransportQuantaWithinMinute),
  );
  if (
    input.temporalPolicyVersion !== TRAFFIC_TEMPORAL_POLICY_VERSION ||
    input.completedTransportQuantaWithinMinute > TRANSPORT_QUANTA_PER_GAME_MINUTE ||
    transportSecondValue(input.absoluteTransportSecond) !==
      transportSecondValue(expectedTransportSecond)
  ) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  return Object.freeze({ ...input });
}

export function advanceTrafficTimeCursor(cursor: TrafficTimeCursor): TrafficTimeCursor {
  const canonical = createTrafficTimeCursor(cursor);
  if (canonical.completedTransportQuantaWithinMinute >= TRANSPORT_QUANTA_PER_GAME_MINUTE) {
    throw new TrafficContractError('traffic:invalid-state');
  }
  return createTrafficTimeCursor({
    ...canonical,
    completedTransportQuantaWithinMinute: canonical.completedTransportQuantaWithinMinute + 1,
    absoluteTransportSecond: addTransportSeconds(
      canonical.absoluteTransportSecond,
      transportSecondDuration(1),
    ),
  });
}
