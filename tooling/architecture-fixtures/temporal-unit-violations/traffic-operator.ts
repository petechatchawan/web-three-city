import type { AbsoluteGameMinute } from '@web-three-city/simulation-core';
import type {
  AbsoluteTransportSecond,
  TransportSecondDuration,
} from '@web-three-city/traffic-core';

declare const gameMinute: AbsoluteGameMinute;
declare const transportSecond: AbsoluteTransportSecond;
declare const duration: TransportSecondDuration;

export const incompatibleArithmetic = gameMinute + transportSecond;
export const incompatibleComparison = gameMinute < transportSecond;
export const rawTransportArithmetic = transportSecond + duration;
