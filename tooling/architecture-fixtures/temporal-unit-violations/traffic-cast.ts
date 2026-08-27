import type { AbsoluteTransportSecond } from '@web-three-city/traffic-core';

declare const value: number;

export const directCast = value as AbsoluteTransportSecond;
export const escapedCast = value as unknown as AbsoluteTransportSecond;

type AliasedTransportSecond = AbsoluteTransportSecond;
export const aliasedCast = value as AliasedTransportSecond;
