import type { AbsoluteGameMinute, MacroHourIndex } from '@web-three-city/simulation-core';

declare const gameMinute: AbsoluteGameMinute;
declare const macroHour: MacroHourIndex;

export const incompatibleArithmetic = gameMinute + macroHour;
export const incompatibleComparison = gameMinute < macroHour;
