import type { AbsoluteGameMinute, MacroHourIndex } from '@web-three-city/simulation-core';

declare const value: number;

export const directCast = value as AbsoluteGameMinute;
export const escapedCast = value as unknown as MacroHourIndex;

type AliasedGameMinute = AbsoluteGameMinute;
export const aliasedCast = value as AliasedGameMinute;
