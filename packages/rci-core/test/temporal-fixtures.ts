import { macroHourIndex } from '@web-three-city/simulation-core';
import { ageOriginMacroHour as createAgeOriginMacroHour } from '../src/index.js';

/** Test-only entry point for constructing validated RCI macro-hour values. */
export const macroHour = macroHourIndex;
export const ageOriginMacroHour = createAgeOriginMacroHour;
